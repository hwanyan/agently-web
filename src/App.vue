<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo">
          <div class="logo-icon">A</div>
          <span class="logo-text">Agently</span>
        </div>
        <!-- 当前 Agent 指示器 -->
        <Transition name="fade">
          <div v-if="activeAgent" class="active-agent-tag">
            <span class="agent-dot" :style="{ background: getAgentDotColor(activeAgent.id) }"></span>
            <span>{{ activeAgent.name }}</span>
          </div>
        </Transition>
      </div>
      <div class="topbar-right">
        <!-- 工具列表按钮 -->
        <button
          class="icon-btn"
          :class="{ active: showTools }"
          title="查看工具"
          @click="toggleTools"
        >
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M14.5 2.5L10 7M10 7H13M10 7V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2.5 14.5L7 10M7 10H4M7 10V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <!-- 清空历史按钮 -->
        <button
          class="icon-btn"
          title="清空对话"
          @click="handleClearHistory"
        >
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M3 4.5H14M6 4.5V3H11V4.5M5.5 4.5L6 13.5H11L11.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 工具侧边栏 -->
    <Transition name="slide-right">
      <div v-if="showTools" class="tools-sidebar">
        <div class="sidebar-header">
          <span>可用工具</span>
          <button class="close-btn-sm" @click="showTools = false">×</button>
        </div>
        <div v-if="toolsLoading" class="sidebar-loading">
          <div class="loading-spinner-sm"></div>
        </div>
        <div v-else class="tools-list">
          <div v-for="tool in tools" :key="tool.name" class="tool-item">
            <div class="tool-icon">🔧</div>
            <div class="tool-info">
              <div class="tool-name">{{ tool.name }}</div>
              <div class="tool-desc">{{ tool.description }}</div>
            </div>
          </div>
          <div v-if="tools.length === 0" class="empty-tools">暂无工具</div>
        </div>
      </div>
    </Transition>

    <!-- 主内容区 -->
    <main class="main-content" :class="{ 'with-sidebar': showTools }">
      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesRef">
        <!-- 欢迎屏 -->
        <Transition name="fade">
          <div v-if="messages.length === 0" class="welcome-screen">
            <div class="welcome-logo">
              <div class="welcome-logo-inner">A</div>
              <div class="welcome-glow"></div>
            </div>
            <h1 class="welcome-title">你好，我是 Agently</h1>
            <p class="welcome-subtitle">多 Agent 智能问答助手，支持天气查询、黄金分析等多种能力</p>
            <div class="welcome-suggestions">
              <button
                v-for="s in suggestions"
                :key="s.text"
                class="suggestion-chip"
                @click="useSuggestion(s.text)"
              >
                <span class="chip-icon">{{ s.icon }}</span>
                <span>{{ s.text }}</span>
              </button>
            </div>
          </div>
        </Transition>

        <!-- 消息列表 -->
        <div class="messages-list">
          <MessageBubble
            v-for="(msg, idx) in messages"
            :key="idx"
            :message="msg"
            :agent-emoji="getAgentEmoji(activeAgent?.id)"
          />
        </div>

        <!-- 底部占位 -->
        <div class="scroll-anchor" ref="scrollAnchorRef"></div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 工具栏 -->
        <div class="input-toolbar">
          <!-- @ Agent 选择按钮 -->
          <button
            class="toolbar-btn at-btn"
            :class="{ active: showAgentPanel }"
            title="选择 Agent (@)"
            @click="openAgentPanel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
              <path d="M11 8c0 2.21-1.343 3.5-3 3.5S5 10.21 5 8s1.343-3.5 3-3.5c1.657 0 3 1.29 3 3.5v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>@</span>
          </button>

          <!-- 自动路由状态 -->
          <div class="route-status" :class="{ auto: autoRoute }">
            <span class="status-dot"></span>
            <span>{{ autoRoute ? '自动路由' : (activeAgent?.name || '手动模式') }}</span>
          </div>

          <div class="toolbar-spacer"></div>

          <!-- 字数统计 -->
          <span v-if="inputText.length > 0" class="char-count" :class="{ warn: inputText.length > 800 }">
            {{ inputText.length }}
          </span>
        </div>

        <!-- 输入框行 -->
        <div class="input-row">
          <div class="textarea-wrapper">
            <textarea
              ref="textareaRef"
              v-model="inputText"
              class="chat-input"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
              :disabled="isStreaming"
              rows="1"
              @keydown.enter.exact.prevent="handleSend"
              @keydown.enter.shift.exact="() => {}"
              @input="autoResize"
            ></textarea>
          </div>
          <button
            class="send-btn"
            :class="{ active: canSend, loading: isStreaming }"
            :disabled="!canSend && !isStreaming"
            @click="isStreaming ? handleStop() : handleSend()"
          >
            <!-- 停止图标 -->
            <svg v-if="isStreaming" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/>
            </svg>
            <!-- 发送图标 -->
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 8L2.5 3L5 8L2.5 13L13.5 8Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </main>

    <!-- Agent 选择面板 -->
    <AgentPanel
      :visible="showAgentPanel"
      :agents="agents"
      :loading="agentsLoading"
      :error="agentsError"
      :auto-route="autoRoute"
      @close="showAgentPanel = false"
      @select="handleAgentSelect"
      @toggle-auto-route="autoRoute = !autoRoute"
      @retry="loadAgents"
    />

    <!-- Toast 通知 -->
    <Transition name="toast">
      <div v-if="toast.visible" class="toast" :class="toast.type">
        <span class="toast-icon">{{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ' }}</span>
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import MessageBubble from './components/MessageBubble.vue'
import AgentPanel from './components/AgentPanel.vue'
import { fetchAgents, switchAgent, fetchHistory, clearHistory, fetchTools, sendMessage } from './api.js'

// ===== 状态 =====
const messages = ref([])
const inputText = ref('')
const isStreaming = ref(false)
const autoRoute = ref(true)

// Agent 相关
const agents = ref([])
const agentsLoading = ref(false)
const agentsError = ref('')
const activeAgent = ref(null)
const showAgentPanel = ref(false)

// 工具相关
const tools = ref([])
const toolsLoading = ref(false)
const showTools = ref(false)

// DOM refs
const messagesRef = ref(null)
const scrollAnchorRef = ref(null)
const textareaRef = ref(null)

// 当前 SSE 控制器
let currentController = null

// Toast
const toast = ref({ visible: false, message: '', type: 'info' })
let toastTimer = null

// 建议问题
const suggestions = [
  { icon: '🌤️', text: '北京今天天气怎么样？' },
  { icon: '📊', text: '最近黄金价格走势如何？' },
  { icon: '🌐', text: '帮我翻译：Hello World' },
  { icon: '📍', text: '查询 8.8.8.8 的地理位置' }
]

// ===== 计算属性 =====
const canSend = computed(() => inputText.value.trim().length > 0 && !isStreaming.value)

// ===== 方法 =====

function showToast(message, type = 'info', duration = 2500) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, message, type }
  toastTimer = setTimeout(() => { toast.value.visible = false }, duration)
}

function getAgentEmoji(id) {
  const map = { general: '🛠️', gold_analysis: '📊' }
  return map[id] || '🤖'
}

function getAgentDotColor(id) {
  const map = { general: '#6366f1', gold_analysis: '#f59e0b' }
  return map[id] || '#06b6d4'
}

async function loadAgents() {
  agentsLoading.value = true
  agentsError.value = ''
  try {
    const data = await fetchAgents()
    agents.value = data.agents || []
    activeAgent.value = agents.value.find(a => a.is_active) || agents.value[0] || null
  } catch (e) {
    agentsError.value = '加载失败，请检查后端服务'
  } finally {
    agentsLoading.value = false
  }
}

async function loadTools() {
  toolsLoading.value = true
  try {
    const data = await fetchTools()
    tools.value = data.tools || []
  } catch {
    tools.value = []
  } finally {
    toolsLoading.value = false
  }
}

async function toggleTools() {
  showTools.value = !showTools.value
  if (showTools.value && tools.value.length === 0) {
    await loadTools()
  }
}

function openAgentPanel() {
  showAgentPanel.value = true
  if (agents.value.length === 0) loadAgents()
}

async function handleAgentSelect(agent) {
  showAgentPanel.value = false
  if (agent.is_active) return
  try {
    await switchAgent(agent.id)
    // 更新本地状态
    agents.value.forEach(a => { a.is_active = a.id === agent.id })
    activeAgent.value = agent
    autoRoute.value = false
    showToast(`已切换到：${agent.name}`, 'success')
    // 重新加载工具
    if (showTools.value) await loadTools()
  } catch (e) {
    showToast(e.message || '切换失败', 'error')
  }
}

async function handleClearHistory() {
  if (messages.value.length === 0) return
  try {
    await clearHistory()
    messages.value = []
    showToast('对话历史已清空', 'success')
  } catch {
    showToast('清空失败', 'error')
  }
}

function useSuggestion(text) {
  inputText.value = text
  nextTick(() => {
    textareaRef.value?.focus()
    autoResize()
  })
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    scrollAnchorRef.value?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  })
}

function handleStop() {
  currentController?.abort()
  currentController = null
  isStreaming.value = false
  // 标记最后一条消息停止流式
  const last = messages.value[messages.value.length - 1]
  if (last && last.streaming) {
    last.streaming = false
    if (!last.content) last.content = '*(已停止)*'
  }
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: text,
    timestamp: new Date().toISOString()
  })

  inputText.value = ''
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
  scrollToBottom()

  // 添加 AI 消息占位，push 后必须通过 messages.value 末尾的响应式 Proxy 来操作
  // 不能直接用本地变量 aiMsg，否则 Vue 追踪不到属性变更，界面不会实时更新
  messages.value.push({
    role: 'assistant',
    content: '',
    streaming: true,
    routeInfo: null,
    timestamp: new Date().toISOString()
  })
  isStreaming.value = true
  scrollToBottom()

  // 通过 getter 函数始终拿到响应式 Proxy 对象
  const getAiMsg = () => messages.value[messages.value.length - 1]

  currentController = sendMessage(text, autoRoute.value, {
    onRoute(data) {
      getAiMsg().routeInfo = data
      // 同步更新 activeAgent
      const matched = agents.value.find(a => a.name === data.agent_name)
      if (matched) {
        agents.value.forEach(a => { a.is_active = a.id === matched.id })
        activeAgent.value = matched
      }
    },
    onMessage(content) {
      getAiMsg().content += content
      scrollToBottom(false)
    },
    onDone() {
      getAiMsg().streaming = false
      isStreaming.value = false
      currentController = null
      scrollToBottom()
    },
    onError(err) {
      const msg = getAiMsg()
      msg.streaming = false
      // 追加错误提示
      messages.value.push({
        role: 'error',
        content: err,
        timestamp: new Date().toISOString()
      })
      isStreaming.value = false
      currentController = null
      scrollToBottom()
    }
  })
}

// ===== 生命周期 =====
onMounted(async () => {
  await loadAgents()
  // 仅在消息列表为空时才加载历史，防止热更新或重复挂载时重复追加
  if (messages.value.length > 0) return
  try {
    const data = await fetchHistory()
    // 过滤掉 tool 角色，只展示 user 和 assistant
    const history = (data.history || []).filter(h => h.role === 'user' || h.role === 'assistant')
    if (history.length > 0) {
      messages.value = history.map(h => ({
        role: h.role,
        content: h.content,
        streaming: false,
        routeInfo: null,
        timestamp: h.timestamp
      }))
      scrollToBottom(false)
    }
  } catch {
    // 忽略历史加载失败
  }
})

// 监听 autoRoute 变化
watch(autoRoute, (val) => {
  if (val) {
    showToast('已开启自动路由', 'info')
  }
})
</script>

<style scoped>
/* ===== 布局 ===== */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
  position: relative;
  overflow: hidden;
}

/* ===== 顶部导航 ===== */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 10;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 800;
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.3px;
}

.active-agent-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text-secondary);
}

.agent-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: rgba(255,255,255,0.12);
}

.icon-btn.active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary-light);
  border-color: rgba(99, 102, 241, 0.3);
}

/* ===== 工具侧边栏 ===== */
.tools-sidebar {
  position: absolute;
  top: 56px;
  right: 0;
  width: 260px;
  height: calc(100% - 56px);
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  z-index: 20;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn-sm {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.loading-spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tools-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tool-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  transition: background var(--transition);
}

.tool-item:hover {
  background: var(--bg-hover);
}

.tool-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tool-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.empty-tools {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== 主内容区 ===== */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: padding-right var(--transition-slow);
}

.main-content.with-sidebar {
  padding-right: 260px;
}

/* ===== 消息容器 ===== */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0 8px;
  scroll-behavior: smooth;
}

/* ===== 欢迎屏 ===== */
.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px 40px;
  text-align: center;
  min-height: 60vh;
}

.welcome-logo {
  position: relative;
  margin-bottom: 24px;
}

.welcome-logo-inner {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 800;
  color: white;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
  position: relative;
  z-index: 1;
}

.welcome-glow {
  position: absolute;
  inset: -12px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 3s ease infinite;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  letter-spacing: -0.5px;
}

.welcome-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  max-width: 360px;
  line-height: 1.6;
  margin-bottom: 32px;
}

.welcome-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 500px;
}

.suggestion-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}

.suggestion-chip:hover {
  background: var(--bg-hover);
  border-color: rgba(99, 102, 241, 0.4);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.chip-icon {
  font-size: 14px;
}

/* ===== 消息列表 ===== */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 max(24px, calc(50% - 380px));
}

.scroll-anchor {
  height: 1px;
}

/* ===== 输入区域 ===== */
.input-area {
  flex-shrink: 0;
  padding: 12px max(24px, calc(50% - 380px)) 20px;
  background: var(--bg-base);
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-color: rgba(255,255,255,0.12);
}

.at-btn {
  color: var(--primary-light);
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.06);
}

.at-btn:hover, .at-btn.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
}

.route-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background var(--transition);
}

.route-status.auto .status-dot {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  animation: pulse 2s ease infinite;
}

.route-status.auto {
  color: #86efac;
}

.toolbar-spacer {
  flex: 1;
}

.char-count {
  font-size: 11px;
  color: var(--text-muted);
}

.char-count.warn {
  color: #f59e0b;
}

/* 输入框行 */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 10px 10px 10px 16px;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.input-row:focus-within {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.textarea-wrapper {
  flex: 1;
  min-width: 0;
}

.chat-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  font-family: inherit;
  min-height: 24px;
  max-height: 160px;
  overflow-y: auto;
}

.chat-input::placeholder {
  color: var(--text-muted);
}

.chat-input:disabled {
  opacity: 0.6;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition);
}

.send-btn.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
}

.send-btn.loading {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.send-btn:disabled:not(.loading) {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ===== Toast ===== */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  z-index: 200;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
}

.toast.success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.toast.error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.toast.info {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
}

.toast-icon {
  font-size: 12px;
  font-weight: 700;
}

/* ===== 过渡动画 ===== */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active, .slide-right-leave-active {
  transition: all 0.25s ease;
}
.slide-right-enter-from, .slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
