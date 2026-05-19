<template>
  <div class="session-sidebar">
    <!-- 头部：用户信息 + 新建会话 -->
    <div class="sidebar-top">
      <div class="user-info">
        <div class="user-avatar">{{ userInitial }}</div>
        <div class="user-detail">
          <div class="user-name">{{ user?.nickname || user?.username || '游客' }}</div>
          <div class="user-sub">{{ user ? user.username : '未登录' }}</div>
        </div>
        <button class="logout-btn" title="退出登录" @click="$emit('logout')">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M5.5 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2.5M10 10.5l3-3-3-3M13 7.5H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <button class="new-session-btn" @click="$emit('new-session')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>新建会话</span>
      </button>
    </div>

    <!-- Agent 过滤标签 -->
    <div class="filter-tabs">
      <button
        class="filter-tab"
        :class="{ active: filterAgent === '' }"
        @click="filterAgent = ''"
      >全部</button>
      <button
        v-for="agent in agents"
        :key="agent.id"
        class="filter-tab"
        :class="{ active: filterAgent === agent.id }"
        @click="filterAgent = agent.id"
      >{{ agentShortName(agent.name) }}</button>
    </div>

    <!-- 会话列表 -->
    <div class="sessions-list">
      <div v-if="loading" class="list-loading">
        <div class="loading-spinner-sm"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="filteredSessions.length === 0" class="list-empty">
        <div class="empty-icon">💬</div>
        <div class="empty-text">暂无会话</div>
        <div class="empty-sub">点击「新建会话」开始对话</div>
      </div>
      <template v-else>
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeSessionId }"
          @click="$emit('select', session)"
        >
          <div class="session-agent-dot" :style="{ background: getAgentColor(session.agent_id) }"></div>
          <div class="session-body">
            <div class="session-title">{{ session.title || '新对话' }}</div>
            <div class="session-meta">
              <span class="session-agent">{{ getAgentShortName(session.agent_id) }}</span>
              <span class="session-dot">·</span>
              <span class="session-time">{{ formatRelTime(session.updated_at) }}</span>
              <span v-if="session.message_cnt > 0" class="session-cnt">{{ session.message_cnt }} 条</span>
            </div>
          </div>
          <button
            class="session-archive-btn"
            title="归档会话"
            @click.stop="$emit('archive', session)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 4H11.5V11.5H1.5V4ZM1.5 1.5H11.5V4H1.5V1.5ZM5 7H8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  user: Object,
  sessions: { type: Array, default: () => [] },
  agents: { type: Array, default: () => [] },
  loading: Boolean,
  activeSessionId: String
})

defineEmits(['new-session', 'select', 'archive', 'logout'])

const filterAgent = ref('')

const filteredSessions = computed(() => {
  if (!filterAgent.value) return props.sessions
  return props.sessions.filter(s => s.agent_id === filterAgent.value)
})

const userInitial = computed(() => {
  const name = props.user?.nickname || props.user?.username || '?'
  return name.charAt(0).toUpperCase()
})

const agentColorMap = {
  general: '#6366f1',
  gold_analysis: '#f59e0b'
}

function getAgentColor(id) {
  return agentColorMap[id] || '#06b6d4'
}

const agentNameMap = {
  general: '通用',
  gold_analysis: '黄金'
}

function getAgentShortName(id) {
  return agentNameMap[id] || id
}

function agentShortName(name) {
  return name.replace('助手', '').replace('分析', '').trim()
}

function formatRelTime(ts) {
  if (!ts) return ''
  const now = Date.now()
  const d = new Date(ts).getTime()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  const date = new Date(ts)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.session-sidebar {
  width: 240px;
  height: 100%;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* 顶部用户区 */
.sidebar-top {
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.user-detail {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.new-session-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px dashed rgba(99, 102, 241, 0.35);
  border-radius: var(--radius-md);
  color: var(--primary-light);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.new-session-btn:hover {
  background: rgba(99, 102, 241, 0.18);
  border-color: rgba(99, 102, 241, 0.6);
}

/* 过滤标签 */
.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-tabs::-webkit-scrollbar { display: none; }

.filter-tab {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
}

.filter-tab:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.filter-tab.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
  color: var(--primary-light);
}

/* 会话列表 */
.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 6px;
}

.list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  font-size: 12px;
  color: var(--text-muted);
}

.loading-spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  gap: 6px;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.empty-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-sub {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

/* 会话条目 */
.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition);
  position: relative;
}

.session-item:hover {
  background: var(--bg-hover);
}

.session-item.active {
  background: rgba(99, 102, 241, 0.12);
}

.session-item:hover .session-archive-btn {
  opacity: 1;
}

.session-agent-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
  align-self: flex-start;
}

.session-body {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}

.session-item.active .session-title {
  color: #c7d2fe;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.session-agent {
  color: var(--text-muted);
}

.session-dot {
  opacity: 0.5;
}

.session-cnt {
  margin-left: auto;
  background: var(--bg-hover);
  padding: 0 5px;
  border-radius: var(--radius-full);
  font-size: 10px;
}

.session-archive-btn {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: all var(--transition);
}

.session-archive-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}
</style>
