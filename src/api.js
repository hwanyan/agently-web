// 同源相对路径前缀，匹配 Nginx 的 ^~ /api/agently/ 反向代理规则
// 后端实际注册的路由就带 /api/agently 前缀（如 /api/agently/auth/send-code）
// 所以 Nginx 不需要 rewrite，原样代理到 127.0.0.1:8081 即可
// 生产环境：https://www.mild-juan-lab.com/api/agently/auth/send-code
//          → Nginx 原样代理 → 后端 :8081 收到 /api/agently/auth/send-code
// 开发环境：vite proxy '/api/agently' 原样转发到 http://localhost:8081
const BASE_URL = '/api/agently'

// ===== Token 管理 =====
export function getToken() {
  return localStorage.getItem('agently_token') || ''
}
export function setToken(token) {
  localStorage.setItem('agently_token', token)
}
export function removeToken() {
  localStorage.removeItem('agently_token')
}
export function getStoredUser() {
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
  return request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email, purpose })
  })
}

/**
 * 用户注册（需先通过 sendCode 获取验证码）
 */
export async function register({ username, email, password, verify_code, nickname = '' }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, verify_code, nickname })
  })
}

/**
 * 用户登录（支持用户名或邮箱）
 */
export async function login({ username, password }) {
  return request('/auth/login', {
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
 */
export async function archiveSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: 'DELETE' })
}

/**
 * 在指定会话中发送消息（SSE 流式，持久化）
 */
export function sendSessionMessage(sessionId, message, autoRoute = true, callbacks = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(`${BASE_URL}/sessions/${sessionId}/chat`, {
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
  return request('/switch', {
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
