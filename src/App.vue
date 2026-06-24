<template>
  <div class="app-container">

    <!-- ===== 登录/注册弹窗 ===== -->
    <AuthModal
      :visible="showAuthModal"
      @close="showAuthModal = false"
      @success="handleAuthSuccess"
    />

    <!-- ===== 新建会话弹窗 ===== -->
    <Transition name="modal">
      <div v-if="showNewSession" class="modal-overlay" @click.self="showNewSession = false">
        <div class="new-session-box">
          <div class="ns-header">
            <span class="ns-title">新建会话</span>
            <button class="close-btn-sm" @click="showNewSession = false">×</button>
          </div>
          <div class="ns-body">
            <label class="field-label">选择 Agent</label>
            <div class="agent-select-list">
              <div
                v-for="agent in agents"
                :key="agent.id"
                class="agent-select-item"
                :class="{ selected: newSessionAgentId === agent.id, disabled: !agent.registered }"
                @click="agent.registered && (newSessionAgentId = agent.id)"
              >
                <div class="agent-sel-avatar" :style="{ background: getAgentColor(agent.id) }">
                  {{ getAgentEmoji(agent.id) }}
                </div>
                <div class="agent-sel-info">
                  <div class="agent-sel-name">{{ agent.name }}</div>
                  <div class="agent-sel-desc">{{ agent.description }}</div>
                </div>
                <div v-if="newSessionAgentId === agent.id" class="agent-sel-check">✓</div>
              </div>
            </div>
            <button
              class="submit-btn"
              :disabled="!newSessionAgentId || newSessionCreating"
              @click="handleCreateSession"
            >
              <span v-if="newSessionCreating" class="btn-spinner"></span>
              <span>{{ newSessionCreating ? '创建中...' : '开始对话' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ===== 主布局 ===== -->
    <div class="layout">

      <!-- 左侧会话侧边栏（登录后显示） -->
      <Transition name="slide-left">
        <SessionSidebar
          v-if="currentUser"
          :user="currentUser"
          :sessions="sessions"
          :agents="agents"
          :loading="sessionsLoading"
          :active-session-id="activeSession?.id"
          @new-session="openNewSession"
          @select="handleSelectSession"
          @archive="handleArchiveSession"
          @logout="handleLogout"
        />
      </Transition>

      <!-- 右侧主区域 -->
      <div class="main-area">

        <!-- 顶部导航栏 -->
        <header class="topbar">
          <div class="topbar-left">
            <div class="logo">
              <div class="logo-icon">A</div>
              <span class="logo-text">Agently</span>
            </div>
            <!-- 当前会话标题 / Agent 标签 -->
            <Transition name="fade">
              <div v-if="activeSession" class="session-tag">
                <span class="session-tag-dot" :style="{ background: getAgentColor(activeSession.agent_id) }"></span>
                <span class="session-tag-title">{{ activeSession.title || '新对话' }}</span>
              </div>
              <div v-else-if="activeAgent" class="active-agent-tag">
                <span class="agent-dot" :style="{ background: getAgentDotColor(activeAgent.id) }"></span>
                <span>{{ activeAgent.name }}</span>
              </div>
            </Transition>
          </div>
          <div class="topbar-right">
            <!-- 未登录时显示登录按钮 -->
            <button v-if="!currentUser" class="login-btn" @click="showAuthModal = true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M1.5 12.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <span>登录 / 注册</span>
            </button>

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
            <!-- 归档按钮 -->
            <button
              class="icon-btn"
              title="归档此会话"
              :disabled="!activeSession"
              @click="activeSession && handleArchiveSession(activeSession)"
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
              <div v-if="messages.length === 0 && !messagesLoading" class="welcome-screen">
                <div class="welcome-logo">
                  <div class="welcome-logo-inner">A</div>
                  <div class="welcome-glow"></div>
                </div>
                <h1 class="welcome-title">你好，我是 Agently</h1>
                <p class="welcome-subtitle">
                  <template v-if="currentUser">欢迎回来，{{ currentUser.nickname || currentUser.username }}！对话记录已自动保存。</template>
                  <template v-else>多 Agent 智能问答助手，支持天气查询、黄金分析等多种能力。<br><span class="subtitle-login-hint">登录后对话记录永久保存 →
                    <button class="inline-login-btn" @click="showAuthModal = true">立即登录</button>
                  </span></template>
                </p>
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

            <!-- 消息加载中 -->
            <div v-if="messagesLoading" class="messages-loading">
              <div class="loading-spinner-sm"></div>
              <span>加载消息中...</span>
            </div>

            <!-- 消息列表 -->
            <div class="messages-list">
              <MessageBubble
                v-for="(msg, idx) in messages"
                :key="idx"
                :message="msg"
                :agent-emoji="getAgentEmoji(activeAgent?.id)"
              />
            </div>

            <div class="scroll-anchor" ref="scrollAnchorRef"></div>
          </div>

          <!-- 输入区域 -->
          <div class="input-area">
            <!-- 持久化模式提示条 -->
            <div v-if="activeSession" class="session-mode-bar">
              <span class="session-mode-icon">💾</span>
              <span>持久化会话 · {{ getAgentShortName(activeSession.agent_id) }}</span>
              <span class="session-mode-sep">·</span>
              <span class="session-mode-id">{{ activeSession.title || '新对话' }}</span>
            </div>

            <!-- 工具栏 -->
            <div class="input-toolbar">
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

              <div class="route-status" :class="{ auto: autoRoute }">
                <span class="status-dot"></span>
                <span>{{ autoRoute ? '自动路由' : (activeAgent?.name || '手动模式') }}</span>
              </div>

              <div class="toolbar-spacer"></div>

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
                <svg v-if="isStreaming" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13.5 8L2.5 3L5 8L2.5 13L13.5 8Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </main>

      </div><!-- /main-area -->
    </div><!-- /layout -->

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
import AuthModal from './components/AuthModal.vue'
import SessionSidebar from './components/SessionSidebar.vue'
import {
  fetchAgents, switchAgent, fetchTools,
  fetchSessions, createSession, fetchSessionMessages, archiveSession, sendSessionMessage,
  getStoredUser, removeToken, removeStoredUser
} from './api.js'

// ===== 用户状态 =====
const currentUser = ref(getStoredUser())
const showAuthModal = ref(false)
const pendingAction = ref(null)  // 登录后待执行的操作

// ===== 会话状态 =====
const sessions = ref([])
const sessionsLoading = ref(false)
const activeSession = ref(null)
const messagesLoading = ref(false)

// 新建会话弹窗
const showNewSession = ref(false)
const newSessionAgentId = ref('')
const newSessionCreating = ref(false)

// ===== 消息状态 =====
const messages = ref([])
const inputText = ref('')
const isStreaming = ref(false)
const autoRoute = ref(true)

// ===== Agent 状态 =====
const agents = ref([])
const agentsLoading = ref(false)
const agentsError = ref('')
const activeAgent = ref(null)
const showAgentPanel = ref(false)

// ===== 工具状态 =====
const tools = ref([])
const toolsLoading = ref(false)
const showTools = ref(false)

// ===== DOM refs =====
const messagesRef = ref(null)
const scrollAnchorRef = ref(null)
const textareaRef = ref(null)

let currentController = null

// ===== Toast =====
const toast = ref({ visible: false, message: '', type: 'info' })
let toastTimer = null

const suggestions = [
  { icon: '🌤️', text: '北京今天天气怎么样？' },
  { icon: '📊', text: '最近黄金价格走势如何？' },
  { icon: '🌐', text: '帮我翻译：Hello World' },
  { icon: '📍', text: '查询 8.8.8.8 的地理位置' }
]

// ===== 计算属性 =====
const canSend = computed(() => inputText.value.trim().length > 0 && !isStreaming.value)

// ===== 工具函数 =====
function showToast(message, type = 'info', duration = 2500) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, message, type }
  toastTimer = setTimeout(() => { toast.value.visible = false }, duration)
}

const agentEmojiMap = { general: '🛠️', gold_analysis: '📊' }
const agentColorMap = { general: '#6366f1', gold_analysis: '#f59e0b' }
const agentShortNameMap = { general: '通用助手', gold_analysis: '黄金助手' }

function getAgentEmoji(id) { return agentEmojiMap[id] || '🤖' }
function getAgentColor(id) { return agentColorMap[id] || '#06b6d4' }
function getAgentDotColor(id) { return agentColorMap[id] || '#06b6d4' }
function getAgentShortName(id) { return agentShortNameMap[id] || id }

// ===== 认证 =====
async function handleAuthSuccess(user) {
  currentUser.value = user
  showAuthModal.value = false
  showToast(`欢迎，${user.nickname || user.username}！`, 'success')
  // 登录成功后串行加载 agents 和会话列表，确保后续 pendingAction 能拿到完整数据
  await loadAgents()
  await loadSessions()
  // 执行登录前用户想进行的操作
  if (pendingAction.value) {
    const action = pendingAction.value
    pendingAction.value = null
    action()
  }
}

function handleLogout() {
  removeToken()
  removeStoredUser()
  currentUser.value = null
  sessions.value = []
  activeSession.value = null
  messages.value = []
  agents.value = []
  showToast('已退出登录', 'info')
}

// ===== 会话管理 =====
async function loadSessions() {
  if (!currentUser.value) return
  sessionsLoading.value = true
  try {
    const data = await fetchSessions()
    sessions.value = data.sessions || []
  } catch (e) {
    showToast('加载会话列表失败', 'error')
  } finally {
    sessionsLoading.value = false
  }
}

function openNewSession() {
  newSessionAgentId.value = agents.value.find(a => a.registered)?.id || ''
  showNewSession.value = true
}

async function handleCreateSession() {
  if (!newSessionAgentId.value) return
  newSessionCreating.value = true
  try {
    const data = await createSession({ agentId: newSessionAgentId.value })
    const session = data.session
    sessions.value.unshift(session)
    showNewSession.value = false
    await handleSelectSession(session)
    showToast('会话已创建', 'success')
  } catch (e) {
    showToast(e.message || '创建失败', 'error')
  } finally {
    newSessionCreating.value = false
  }
}

async function handleSelectSession(session) {
  if (activeSession.value?.id === session.id) return
  // 停止当前流式
  if (isStreaming.value) handleStop()
  activeSession.value = session
  messages.value = []
  messagesLoading.value = true
  try {
    const data = await fetchSessionMessages(session.id)
    const msgs = (data.messages || []).filter(m => m.role === 'user' || m.role === 'assistant')
    messages.value = msgs.map(m => ({
      role: m.role,
      content: m.content,
      streaming: false,
      routeInfo: null,
      timestamp: m.created_at
    }))
    scrollToBottom(false)
  } catch (e) {
    showToast('加载消息失败', 'error')
  } finally {
    messagesLoading.value = false
  }
}

async function handleArchiveSession(session) {
  try {
    await archiveSession(session.id)
    sessions.value = sessions.value.filter(s => s.id !== session.id)
    if (activeSession.value?.id === session.id) {
      activeSession.value = null
      messages.value = []
    }
    showToast('会话已归档', 'success')
  } catch (e) {
    showToast(e.message || '归档失败', 'error')
  }
}

// ===== Agent 管理 =====
async function loadAgents() {
  agentsLoading.value = true
  agentsError.value = ''
  try {
    const data = await fetchAgents()
    agents.value = data.agents || []
    activeAgent.value = agents.value.find(a => a.is_active) || agents.value[0] || null
  } catch {
    agentsError.value = '加载失败，请检查后端服务'
  } finally {
    agentsLoading.value = false
  }
}

function openAgentPanel() {
  requireAuth(() => {
    showAgentPanel.value = true
    if (agents.value.length === 0) loadAgents()
  })
}

async function handleAgentSelect(agent) {
  showAgentPanel.value = false
  // 会话模式：不切换全局 Agent，而是新建对应 Agent 的会话
  if (currentUser.value && activeSession.value) {
    showToast('会话模式下请新建会话来切换 Agent', 'info')
    return
  }
  if (agent.is_active) return
  try {
    await switchAgent(agent.id)
    agents.value.forEach(a => { a.is_active = a.id === agent.id })
    activeAgent.value = agent
    autoRoute.value = false
    showToast(`已切换到：${agent.name}`, 'success')
    if (showTools.value) await loadTools()
  } catch (e) {
    showToast(e.message || '切换失败', 'error')
  }
}

// ===== 工具 =====
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
  if (!currentUser.value) {
    requireAuth(() => toggleTools())
    return
  }
  showTools.value = !showTools.value
  if (showTools.value && tools.value.length === 0) await loadTools()
}

// ===== 发送消息 =====
function useSuggestion(text) {
  inputText.value = text
  nextTick(() => { textareaRef.value?.focus(); autoResize() })
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
  const last = messages.value[messages.value.length - 1]
  if (last?.streaming) {
    last.streaming = false
    if (!last.content) last.content = '*(已停止)*'
  }
}

// 需要登录时弹出登录框，登录成功后执行回调
function requireAuth(callback) {
  if (currentUser.value) {
    callback()
    return
  }
  // 记录待执行的操作，登录成功后自动触发
  pendingAction.value = callback
  showAuthModal.value = true
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  // 未登录时弹出登录框，登录后自动继续发送
  if (!currentUser.value) {
    requireAuth(() => handleSend())
    return
  }

  // 没有活跃会话时自动创建一个
  if (!activeSession.value) {
    // agents 可能尚未加载完，或后端返回为空，先兜底加载一次
    if (agents.value.length === 0) {
      await loadAgents()
    }
    const defaultAgent = agents.value.find(a => a.registered) || agents.value[0]
    if (!defaultAgent) {
      showToast('暂无可用 Agent，请稍后重试', 'error')
      return
    }
    try {
      const data = await createSession({ agentId: defaultAgent.id })
      activeSession.value = data.session
      sessions.value.unshift(data.session)
    } catch {
      showToast('创建会话失败，请重试', 'error')
      return
    }
  }

  // 兜底防御：理论上不会再为 null，万一还是 null 直接拒绝发送，避免读取 .id 崩溃
  if (!activeSession.value) {
    showToast('会话未就绪，请重试', 'error')
    return
  }

  // 添加用户消息
  messages.value.push({ role: 'user', content: text, timestamp: new Date().toISOString() })
  inputText.value = ''
  nextTick(() => { if (textareaRef.value) textareaRef.value.style.height = 'auto' })
  scrollToBottom()

  // 添加 AI 占位消息
  messages.value.push({
    role: 'assistant', content: '', streaming: true, routeInfo: null,
    toolWarnings: [],
    timestamp: new Date().toISOString()
  })
  isStreaming.value = true
  scrollToBottom()

  const getAiMsg = () => messages.value[messages.value.length - 1]
  // 已发生致命错误标志位：避免后续 onMessage 继续往气泡里写内容
  let fatalErrored = false

  const callbacks = {
    onRoute(data) {
      getAiMsg().routeInfo = data
      const matched = agents.value.find(a => a.name === data.agent_name)
      if (matched) {
        agents.value.forEach(a => { a.is_active = a.id === matched.id })
        activeAgent.value = matched
      }
    },
    onMessage(content) {
      if (fatalErrored) return
      getAiMsg().content += content
      scrollToBottom(false)
    },
    onToolCall(data) {
      // 工具调用开始：可在此记录调用中状态（暂只忽略，不影响主流）
    },
    onToolResult(data) {
      // 工具调用成功：暂不在 UI 单独展示
    },
    onToolError(data) {
      // 工具单次失败：作为非致命警告挂到当前 AI 气泡，不打断流式输出
      const ai = getAiMsg()
      if (!ai.toolWarnings) ai.toolWarnings = []
      ai.toolWarnings.push({
        tool_name: data.tool_name || '',
        error: data.error || '工具调用失败',
      })
      scrollToBottom(false)
    },
    onDone() {
      getAiMsg().streaming = false
      isStreaming.value = false
      currentController = null
      scrollToBottom()
      // 刷新会话列表（更新 message_cnt 和 updated_at）
      loadSessions()
    },
    onError(err) {
      // 致命错误：阻断后续 onMessage 写入，关闭流式状态
      if (fatalErrored) return
      fatalErrored = true
      getAiMsg().streaming = false
      messages.value.push({ role: 'error', content: err || '未知错误', timestamp: new Date().toISOString() })
      isStreaming.value = false
      // 主动取消上游 SSE，避免后端继续推送被丢弃的数据
      currentController?.abort()
      currentController = null
      scrollToBottom()
    }
  }

  // 始终使用持久化会话接口
  currentController = sendSessionMessage(activeSession.value.id, text, autoRoute.value, callbacks)
}

// ===== 生命周期 =====
onMounted(async () => {
  // 已登录：静默加载数据
  if (currentUser.value) {
    await loadAgents()
    await loadSessions()
  }
  // 未登录：直接展示主界面，不弹框
})

watch(autoRoute, (val) => {
  if (val) showToast('已开启自动路由', 'info')
})
</script>

<style scoped>
/* ===== 根容器 ===== */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
  overflow: hidden;
}

/* ===== 主布局（左右分栏） ===== */
.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ===== 右侧主区域 ===== */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
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
  min-width: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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

.session-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 200px;
  overflow: hidden;
}

.session-tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.session-tag-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex-shrink: 0;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-full);
  color: var(--primary-light);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.login-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-full);
  color: var(--primary-light);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.login-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
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
}

.icon-btn.active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary-light);
  border-color: rgba(99, 102, 241, 0.3);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
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

.tool-item:hover { background: var(--bg-hover); }

.tool-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.tool-info { flex: 1; min-width: 0; }

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

.main-content.with-sidebar { padding-right: 260px; }

/* ===== 消息容器 ===== */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0 8px;
}

.messages-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  font-size: 13px;
  color: var(--text-muted);
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
  max-width: 380px;
  line-height: 1.6;
  margin-bottom: 32px;
}

.subtitle-login-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
}

.inline-login-btn {
  background: none;
  border: none;
  color: var(--primary-light);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color var(--transition);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.inline-login-btn:hover {
  color: white;
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

.chip-icon { font-size: 14px; }

/* ===== 消息列表 ===== */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 max(24px, calc(50% - 380px));
}

.scroll-anchor { height: 1px; }

/* ===== 输入区域 ===== */
.input-area {
  flex-shrink: 0;
  padding: 0 max(24px, calc(50% - 380px)) 20px;
  background: var(--bg-base);
}

/* 持久化模式提示条 */
.session-mode-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}

.session-mode-icon { font-size: 12px; }

.session-mode-sep { opacity: 0.4; }

.session-mode-id {
  color: var(--primary-light);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
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

.route-status.auto { color: #86efac; }

.toolbar-spacer { flex: 1; }

.char-count { font-size: 11px; color: var(--text-muted); }
.char-count.warn { color: #f59e0b; }

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

.textarea-wrapper { flex: 1; min-width: 0; }

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

.chat-input::placeholder { color: var(--text-muted); }
.chat-input:disabled { opacity: 0.6; }

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

/* ===== 新建会话弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  padding: 20px;
}

.new-session-box {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.ns-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.ns-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.ns-body {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.agent-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-select-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--transition);
}

.agent-select-item:hover:not(.disabled) {
  background: var(--bg-hover);
  border-color: rgba(99, 102, 241, 0.3);
}

.agent-select-item.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.5);
}

.agent-select-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.agent-sel-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.agent-sel-info { flex: 1; min-width: 0; }

.agent-sel-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.agent-sel-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.agent-sel-check {
  color: var(--primary-light);
  font-weight: 700;
  font-size: 14px;
}

.submit-btn {
  width: 100%;
  padding: 11px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity var(--transition);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.35);
}

.submit-btn:hover:not(:disabled) { opacity: 0.9; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
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
  z-index: 400;
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

.toast-icon { font-size: 12px; font-weight: 700; }

/* ===== 过渡动画 ===== */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-left-enter-active, .slide-left-leave-active { transition: all 0.25s ease; }
.slide-left-enter-from, .slide-left-leave-to { transform: translateX(-100%); opacity: 0; }

.slide-right-enter-active, .slide-right-leave-active { transition: all 0.25s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); opacity: 0; }

.modal-enter-active { transition: all 0.25s ease; }
.modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .new-session-box, .modal-leave-to .new-session-box {
  transform: scale(0.95) translateY(8px);
}

.toast-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
