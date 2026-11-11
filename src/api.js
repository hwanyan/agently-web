// 同源相对路径前缀，匹配 Nginx 的 ^~ /api/agently/ 反向代理规则
// 后端已切换为 gRPC + grpc-gateway，原生路由前缀为 /v1/（详见 pb/gen/agently.swagger.json）。
// Nginx / Vite 代理均通过 rewrite 把浏览器可见的 /api/agently/ 前缀剥离，
// 让后端只感知 /v1/xxx 原生路径：
//   浏览器: /api/agently/v1/auth:login
//   → Nginx (proxy_pass http://agently_backend/;) 剥掉 /api/agently/
//   → 后端 :8081 收到 /v1/auth:login
// 开发环境：vite proxy '/api/agently' + rewrite('' 剥前缀) → http://localhost:8081/v1/...
const BASE_URL = '/api/agently/v1'

// ===== Token 管理 =====
// JWT 解析工具：从 token 中提取过期时间戳（秒）。失败返回 0
function parseJwtExp(token) {
  if (!token || typeof token !== 'string') return 0
  const parts = token.split('.')
  if (parts.length !== 3) return 0
  try {
    // base64url → base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    const json = decodeURIComponent(
      atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    const payload = JSON.parse(json)
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}

// 判断指定 token 是否已过期（含 30 秒安全提前量）。无 exp 字段视为不会过期
export function isTokenExpired(token) {
  const exp = parseJwtExp(token)
  if (!exp) return false
  return Date.now() >= (exp - 30) * 1000
}

// 令牌模型：
//   - Access Token（agently_token）：短寿命 JWT（默认 15 分钟），每个请求都带；过期后自动用 Refresh Token 换新；
//   - Refresh Token（agently_refresh_token）：长寿命，只用于换取新令牌；每次使用都会轮换，必须及时写回。
// 「是否已登录」以 Refresh Token 是否存在为准：Access Token 过期只代表需要刷新，不代表登录失效。

// 派发全局事件 + 清理本地凭证。登录态确实失效（刷新失败 / 刷新令牌被拒）时调用
export function dispatchAuthExpired(reason = 'expired') {
  removeToken()
  removeStoredUser()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agently:auth-expired', { detail: { reason } }))
  }
}

export function getToken() {
  return localStorage.getItem('agently_token') || ''
}
export function getRefreshToken() {
  return localStorage.getItem('agently_refresh_token') || ''
}
// 是否持有登录态（有 Refresh Token 即视为已登录，Access Token 过期会自动刷新）
export function hasSession() {
  return !!getRefreshToken()
}
// 同时写入 Access Token 与 Refresh Token（登录 / 注册 / 刷新成功后调用）
export function setTokens(accessToken, refreshToken) {
  localStorage.setItem('agently_token', accessToken)
  localStorage.setItem('agently_refresh_token', refreshToken)
}
// 清除全部令牌
export function removeToken() {
  localStorage.removeItem('agently_token')
  localStorage.removeItem('agently_refresh_token')
}
// 读取本地用户信息：仅当持有登录态时才返回，否则同步清理 localStorage
// 解决场景：登录失效后再回到页面时，左上角仍展示旧用户名/头像，造成信息泄露
export function getStoredUser() {
  if (!hasSession()) {
    // 静默清理，不派发事件（onMounted 阶段尚无监听者，且本就是未登录态）
    removeToken()
    removeStoredUser()
    return null
  }
  try {
    return JSON.parse(localStorage.getItem('agently_user') || 'null')
  } catch { return null }
}
export function setStoredUser(user) {
  localStorage.setItem('agently_user', JSON.stringify(user))
}
export function removeStoredUser() {
  localStorage.removeItem('agently_user')
}

// ===== Access Token 自动刷新 =====
//
// Access Token 过期后业务接口返回 401。此时用 Refresh Token 换一对新令牌并重试原请求，用户无感知；
// 只有刷新也失败（Refresh Token 过期 / 被吊销 / 账号被禁用）才广播 auth-expired 回到登录。
//
// 两层互斥，缺一不可：
//   1. 同一标签页内，多个并发请求同时 401，只发一次刷新（inflightRefresh 合并）；
//   2. 多个标签页之间，用 Web Locks 串行化，并在拿到锁后先看 localStorage 里的 token 是否已被其它标签页换新。
// Refresh Token 每次使用都会轮换，两个标签页拿同一个旧的 Refresh Token 去刷新，后到者会被服务端当成重放，
// 整条登录链路被吊销、用户被迫重新登录——这正是需要互斥的原因。
let inflightRefresh = null

function refreshSession(usedToken) {
  if (!inflightRefresh) {
    inflightRefresh = runExclusive(() => doRefresh(usedToken)).finally(() => { inflightRefresh = null })
  }
  return inflightRefresh
}

async function runExclusive(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request('agently-auth-refresh', fn)
  }
  return fn()
}

async function doRefresh(usedToken) {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  // 等锁期间别的标签页（或别的请求）已经换过新 token：直接用它重试，不要再拿旧 Refresh Token 去刷新
  const current = getToken()
  if (usedToken && current && current !== usedToken) return true

  try {
    const res = await fetch(`${BASE_URL}/auth:refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    if (res.ok) {
      const data = await res.json()
      setTokens(data.token, data.refresh_token)
      if (data.user) setStoredUser(data.user)
      return true
    }
    // 401/403：Refresh Token 已失效或账号被禁用，登录态无法挽回
    if (res.status === 401 || res.status === 403) dispatchAuthExpired('unauthorized')
    // 其它（如 503 认证服务暂不可用）：保留登录态，下次请求再试，避免服务抖动把用户踢下线
    return false
  } catch {
    return false // 网络错误：同上，保留登录态
  }
}

// 带登录态的 fetch：Access Token 已过期则先刷新；遇到 401 刷新并重试一次。
// 401 发生在服务端处理之前（鉴权层），因此重试不会造成非幂等请求被重复执行。
async function authedFetch(url, options = {}) {
  const send = (token) => fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  // 注册 / 登录 / 发验证码 / 刷新 / 登出（/auth:xxx）的 401 是「账号、验证码或令牌无效」之类的业务失败，
  // 不代表需要刷新登录态，直接发送即可
  if (url.startsWith('/auth:')) return send(getToken())

  let usedToken = getToken()
  // 本地就能判断已过期：先刷新，省掉一次必然失败的往返
  if (usedToken && isTokenExpired(usedToken) && hasSession()) {
    if (await refreshSession(usedToken)) usedToken = getToken()
  }

  let res = await send(usedToken)
  if (res.status !== 401 || !hasSession()) return res

  if (await refreshSession(usedToken)) {
    res = await send(getToken())
    // 换了新令牌仍然 401：登录态确实无效
    if (res.status === 401) dispatchAuthExpired('unauthorized')
  }
  return res
}

// ===== 通用请求工具 =====
async function request(url, options = {}) {
  const res = await authedFetch(url, options)
  const data = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
  // 403：账号被禁用等，登录态无法继续使用，统一清理本地态并广播事件
  if (res.status === 403 && hasSession()) {
    dispatchAuthExpired('forbidden')
  }
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

// ===== 用户认证 =====

/**
 * 发送邮箱验证码
 * @param {string} email - 目标邮箱
 * @param {string} purpose - 用途：register（注册）/ reset_password（重置密码）
 */
export async function sendCode({ email, purpose = 'register' }) {
  return request('/auth:sendVerifyCode', {
    method: 'POST',
    body: JSON.stringify({ email, purpose })
  })
}

/**
 * 用户注册（需先通过 sendCode 获取验证码）
 */
export async function register({ username, email, password, verify_code, nickname = '' }) {
  return request('/auth:register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, verify_code, nickname })
  })
}

/**
 * 用户登录（支持用户名或邮箱）
 */
export async function login({ username, password }) {
  return request('/auth:login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

/**
 * 登出：通知服务端吊销当前登录链路（其 Refresh Token 立即全部失效，无法再刷新）
 *
 * 约定：
 * - 必须在清理本地凭证【之前】调用（函数同步读取 token，之后调用方可立即清理本地态）
 * - 不走通用 request()：它会在 401/403 时触发刷新或广播 auth-expired，而登出场景下 Access Token 已过期是正常情况
 *   （服务端只要求签名有效，允许已过期）
 * - 失败（网络错误等）不影响本地登出，故吞掉错误；服务端 Refresh Token 最终会按空闲时间自然过期
 */
export async function logout() {
  const token = localStorage.getItem('agently_token') || ''
  if (!token) return
  try {
    await fetch(`${BASE_URL}/auth:logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: '{}'
    })
  } catch { /* 忽略：本地登出照常进行 */ }
}

// ===== 会话管理 =====

/**
 * 查询会话列表
 */
export async function fetchSessions({ agentId = '', limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset })
  if (agentId) params.set('agent_id', agentId)
  return request(`/sessions?${params}`)
}

/**
 * 创建新会话
 */
export async function createSession({ agentId, title = '' }) {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, title })
  })
}

/**
 * 查询会话消息历史
 */
export async function fetchSessionMessages(sessionId, { limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset })
  return request(`/sessions/${sessionId}/messages?${params}`)
}

/**
 * 归档会话（软删除）
 * grpc-gateway 动作型接口：POST /sessions/{id}:archive，body 需为空对象
 */
export async function archiveSession(sessionId) {
  return request(`/sessions/${sessionId}:archive`, {
    method: 'POST',
    body: '{}'
  })
}

/**
 * 在指定会话中发送消息（SSE 流式，持久化）
 */
export function sendSessionMessage(sessionId, message, autoRoute = true, callbacks = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      // 走 authedFetch：Access Token 过期时自动刷新并重试（401 发生在流开始之前，重试安全）
      const response = await authedFetch(`/sessions/${sessionId}:chat`, {
        method: 'POST',
        body: JSON.stringify({ message, auto_route: autoRoute }),
        signal: controller.signal
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
        if (response.status === 403 && hasSession()) {
          dispatchAuthExpired('forbidden')
        }
        callbacks.onError?.(err.message || '请求失败')
        return
      }

      await consumeSSE(response, callbacks)
    } catch (err) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err.message || '网络连接失败')
      }
    }
  })()

  return controller
}

// ===== Agent 管理（需要 JWT） =====

export async function fetchAgents() {
  return request('/agents')
}

export async function switchAgent(agentId) {
  return request('/agents:switch', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId })
  })
}

// ===== 工具列表（需要 JWT） =====

export async function fetchTools() {
  return request('/tools')
}

// ===== SSE 公共解析器 =====
// 一旦遇到 error / done 事件，立即停止后续事件分发并退出读循环，
// 防止"已经触发错误提示"的同时又有 message/tool_* 事件继续往 UI 灌内容，
// 导致 UI 状态（已停止流）与实际内容（仍在追加）相互矛盾。
async function consumeSSE(response, callbacks) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = ''  // 跨 chunk 持久化，空行时重置
  let aborted = false // 收到 error/done 后置 true，立即终止后续处理

  outer: while (!aborted) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (aborted) break outer
      if (line === '') {
        eventType = ''
      } else if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          switch (eventType) {
            case 'route':       callbacks.onRoute?.(data); break
            case 'message':     callbacks.onMessage?.(data.content); break
            case 'tool_call':   callbacks.onToolCall?.(data); break
            case 'tool_result': callbacks.onToolResult?.(data); break
            case 'tool_error':  callbacks.onToolError?.(data); break
            case 'done':        aborted = true; callbacks.onDone?.(); break
            case 'error':       aborted = true; callbacks.onError?.(data.error || '未知错误'); break
          }
        } catch {
          // 忽略 JSON 解析错误
        }
      }
    }
  }

  // 主动取消底层连接，避免后端继续向已断开的 reader 推送数据
  if (aborted) {
    try { await reader.cancel() } catch { /* 已关闭则忽略 */ }
  }
}
