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

// 派发全局事件 + 清理本地凭证。供 401/403 与过期检测共用
export function dispatchAuthExpired(reason = 'expired') {
  removeToken()
  removeStoredUser()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agently:auth-expired', { detail: { reason } }))
  }
}

export function getToken() {
  const token = localStorage.getItem('agently_token') || ''
  // token 已过期：直接清理，避免后续请求带着无效 Authorization 浪费往返
  if (token && isTokenExpired(token)) {
    dispatchAuthExpired('expired')
    return ''
  }
  return token
}
export function setToken(token) {
  localStorage.setItem('agently_token', token)
}
export function removeToken() {
  localStorage.removeItem('agently_token')
}
// 读取本地用户信息：仅当 token 仍然有效时才返回，否则同步清理 localStorage
// 解决场景：用户登录后超过 JWT 有效期再回到页面时，左上角仍展示旧用户名/头像，造成信息泄露
export function getStoredUser() {
  const token = localStorage.getItem('agently_token') || ''
  if (!token || isTokenExpired(token)) {
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

// ===== 通用请求工具 =====
function authHeaders() {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  })
  const data = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
  // 401/403：服务端判定凭证失效，统一清理本地态并广播事件
  if (res.status === 401 || res.status === 403) {
    dispatchAuthExpired('unauthorized')
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
      const response = await fetch(`${BASE_URL}/sessions/${sessionId}:chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ message, auto_route: autoRoute }),
        signal: controller.signal
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
        if (response.status === 401 || response.status === 403) {
          dispatchAuthExpired('unauthorized')
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
