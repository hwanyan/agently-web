const BASE_URL = 'http://localhost:8088'

/**
 * 获取可用 Agent 列表
 */
export async function fetchAgents() {
  const res = await fetch(`${BASE_URL}/api/agents`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 切换当前激活的 Agent
 * @param {string} agentId
 */
export async function switchAgent(agentId) {
  const res = await fetch(`${BASE_URL}/api/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

/**
 * 获取当前 Agent 的对话历史
 */
export async function fetchHistory() {
  const res = await fetch(`${BASE_URL}/api/history`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 清空当前 Agent 的对话历史
 */
export async function clearHistory() {
  const res = await fetch(`${BASE_URL}/api/history`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 获取当前 Agent 的工具列表
 */
export async function fetchTools() {
  const res = await fetch(`${BASE_URL}/api/tools`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 发送消息并通过 SSE 流式接收回答
 * @param {string} message - 用户消息
 * @param {boolean} autoRoute - 是否自动路由
 * @param {object} callbacks - 回调函数集合
 * @param {function} callbacks.onRoute - 路由事件回调 (data) => void
 * @param {function} callbacks.onMessage - 消息片段回调 (content) => void
 * @param {function} callbacks.onDone - 完成回调 () => void
 * @param {function} callbacks.onError - 错误回调 (error) => void
 * @returns {AbortController} - 可用于取消请求
 */
export function sendMessage(message, autoRoute = true, callbacks = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, auto_route: autoRoute }),
        signal: controller.signal
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
        callbacks.onError?.(err.message || '请求失败')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''  // 提升到 while 外，跨 chunk 持久化

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line === '') {
            // 空行是 SSE 事件块的分隔符，重置 eventType
            eventType = ''
          } else if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (eventType) {
                case 'route':
                  callbacks.onRoute?.(data)
                  break
                case 'message':
                  callbacks.onMessage?.(data.content)
                  break
                case 'done':
                  callbacks.onDone?.()
                  break
                case 'error':
                  callbacks.onError?.(data.error || '未知错误')
                  break
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err.message || '网络连接失败')
      }
    }
  })()

  return controller
}
