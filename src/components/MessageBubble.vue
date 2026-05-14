<template>
  <div class="message-wrapper" :class="message.role">
    <!-- AI 消息 -->
    <template v-if="message.role === 'assistant'">
      <div class="avatar ai-avatar">
        <span>{{ agentEmoji }}</span>
      </div>
      <div class="bubble-group">
        <!-- 路由标签 -->
        <div v-if="message.routeInfo" class="route-tag">
          <span class="route-dot"></span>
          <span>{{ message.routeInfo.agent_name }}</span>
          <span class="route-reason">· {{ message.routeInfo.reason }}</span>
        </div>
        <div class="bubble ai-bubble">
          <!-- 流式打字光标 -->
          <div
            v-if="message.streaming"
            class="md-content"
            v-html="renderedContent + '<span class=\'cursor\'></span>'"
          ></div>
          <div v-else class="md-content" v-html="renderedContent"></div>
          <!-- 工具调用提示 -->
          <div v-if="message.toolCalling" class="tool-calling">
            <div class="tool-spinner"></div>
            <span>正在调用工具...</span>
          </div>
        </div>
        <div class="message-meta">
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>
    </template>

    <!-- 用户消息 -->
    <template v-else-if="message.role === 'user'">
      <div class="bubble-group user-group">
        <div class="bubble user-bubble">
          <span>{{ message.content }}</span>
        </div>
        <div class="message-meta user-meta">
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>
      <div class="avatar user-avatar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="3" fill="currentColor"/>
          <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </template>

    <!-- 系统/错误消息 -->
    <template v-else-if="message.role === 'error'">
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span>{{ message.content }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  message: { type: Object, required: true },
  agentEmoji: { type: String, default: '🤖' }
})

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  try {
    return marked.parse(props.message.content)
  } catch {
    return props.message.content
  }
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
</script>

<style scoped>
.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  animation: fadeIn 0.25s ease;
  padding: 0 4px;
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

/* 头像 */
.avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  margin-top: 2px;
}

.ai-avatar {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.user-avatar {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

/* 气泡组 */
.bubble-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: calc(100% - 50px);
}

.user-group {
  align-items: flex-end;
}

/* 路由标签 */
.route-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 0;
}

.route-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse 2s ease infinite;
}

.route-reason {
  color: var(--text-muted);
  opacity: 0.7;
}

/* 气泡 */
.bubble {
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
}

.ai-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-top-left-radius: var(--radius-sm);
}

.user-bubble {
  background: var(--user-bubble);
  color: white;
  border-bottom-right-radius: var(--radius-sm);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
}

/* 打字光标 */
:deep(.cursor) {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--primary-light);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s ease infinite;
  border-radius: 1px;
}

/* 工具调用 */
.tool-calling {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}

.tool-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 时间戳 */
.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
}

.user-meta {
  justify-content: flex-end;
}

.timestamp {
  font-size: 11px;
  color: var(--text-muted);
}

/* 错误消息 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: #f87171;
  width: 100%;
}

.error-icon {
  font-size: 14px;
  flex-shrink: 0;
}
</style>
