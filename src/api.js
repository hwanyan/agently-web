const BASE_URL = 'http://localhost:8088'

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
 * 用户注册
 */
export async function register({ username, email, password, nickname = '' }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, nickname })
  })
}

/**
 * 用户登录（支持用户名或邮箱）
 */
export async function login({ username, password }) {
  return request('/api/auth/login', {
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
  return request(`/api/sessions?${params}`)
}

/**
 * 创建新会话
 */
export async function createSession({ agentId, title = '' }) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, title })
  })
}

/**
 * 查询会话消息历史
 */
export async function fetchSessionMessages(sessionId, { limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset })
  return request(`/api/sessions/${sessionId}/messages?${params}`)
}

/**
 * 归档会话（软删除）
 */
export async function archiveSession(sessionId) {
  return request(`/api/sessions/${sessionId}`, { method: 'DELETE' })
}

/**
 * 在指定会话中发送消息（SSE 流式，持久化）
 */
export function sendSessionMessage(sessionId, message, autoRoute = true, callbacks = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/sessions/${sessionId}/chat`, {
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
  return request('/api/agents')
}

export async function switchAgent(agentId) {
  return request('/api/switch', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId })
  })
}

// ===== 工具列表（需要 JWT） =====

export async function fetchTools() {
  return request('/api/tools')
}

// ===== SSE 公共解析器 =====
async function consumeSSE(response, callbacks) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = ''  // 跨 chunk 持久化，空行时重置

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line === '') {
        eventType = ''
      } else if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          switch (eventType) {
            case 'route':   callbacks.onRoute?.(data); break
            case 'message': callbacks.onMessage?.(data.content); break
            case 'done':    callbacks.onDone?.(); break
            case 'error':   callbacks.onError?.(data.error || '未知错误'); break
          }
        } catch {
          // 忽略 JSON 解析错误
        }
      }
    }
  }
}
