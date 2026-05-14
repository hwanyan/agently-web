<template>
  <Transition name="agent-panel">
    <div v-if="visible" class="agent-panel-overlay" @click.self="$emit('close')">
      <div class="agent-panel">
        <!-- 头部 -->
        <div class="panel-header">
          <div class="panel-title">
            <span class="panel-icon">⚡</span>
            <span>选择 Agent</span>
          </div>
          <button class="close-btn" @click="$emit('close')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- 路由模式提示 -->
        <div class="route-tip">
          <div class="tip-icon">🤖</div>
          <div class="tip-text">
            <div class="tip-title">自动路由模式</div>
            <div class="tip-desc">系统会智能分析你的意图，自动选择最合适的 Agent</div>
          </div>
          <button
            class="route-toggle"
            :class="{ active: autoRoute }"
            @click="$emit('toggle-auto-route')"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Agent 列表 -->
        <div class="agent-list">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
            <button @click="$emit('retry')">重试</button>
          </div>
          <template v-else>
            <div
              v-for="agent in agents"
              :key="agent.id"
              class="agent-item"
              :class="{
                active: agent.is_active,
                selected: selectedId === agent.id,
                disabled: !agent.registered
              }"
              @click="agent.registered && handleSelect(agent)"
            >
              <div class="agent-avatar" :style="{ background: getAgentColor(agent.id) }">
                {{ getAgentEmoji(agent.id) }}
              </div>
              <div class="agent-info">
                <div class="agent-name">
                  {{ agent.name }}
                  <span v-if="agent.is_active" class="active-badge">当前</span>
                  <span v-if="!agent.registered" class="offline-badge">离线</span>
                </div>
                <div class="agent-desc">{{ agent.description }}</div>
              </div>
              <div v-if="agent.is_active" class="check-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </template>
        </div>

        <!-- 底部提示 -->
        <div class="panel-footer">
          <span>切换 Agent 不会清空对话历史</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  agents: { type: Array, default: () => [] },
  loading: Boolean,
  error: String,
  autoRoute: Boolean
})

const emit = defineEmits(['close', 'select', 'toggle-auto-route', 'retry'])

const selectedId = ref(null)

watch(() => props.visible, (v) => {
  if (v) selectedId.value = null
})

function handleSelect(agent) {
  selectedId.value = agent.id
  setTimeout(() => {
    emit('select', agent)
  }, 150)
}

const agentColors = {
  general: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  gold_analysis: 'linear-gradient(135deg, #f59e0b, #d97706)',
  default: 'linear-gradient(135deg, #06b6d4, #0891b2)'
}

const agentEmojis = {
  general: '🛠️',
  gold_analysis: '📊',
  default: '🤖'
}

function getAgentColor(id) {
  return agentColors[id] || agentColors.default
}

function getAgentEmoji(id) {
  return agentEmojis[id] || agentEmojis.default
}
</script>

<style scoped>
.agent-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: 0 0 80px;
}

.agent-panel {
  width: 100%;
  max-width: 480px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl) var(--radius-xl) var(--radius-lg) var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 40px rgba(99, 102, 241, 0.1);
  overflow: hidden;
}

/* 头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-icon {
  font-size: 16px;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.close-btn:hover {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary-light);
}

/* 路由模式 */
.route-tip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(99, 102, 241, 0.06);
  border-bottom: 1px solid var(--border);
}

.tip-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.tip-text {
  flex: 1;
  min-width: 0;
}

.tip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tip-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.route-toggle {
  width: 40px;
  height: 22px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--bg-hover);
  cursor: pointer;
  position: relative;
  transition: background var(--transition);
  flex-shrink: 0;
}

.route-toggle.active {
  background: var(--primary);
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform var(--transition);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.route-toggle.active .toggle-knob {
  transform: translateX(18px);
}

/* Agent 列表 */
.agent-list {
  padding: 10px 12px;
  max-height: 280px;
  overflow-y: auto;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-state button {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--primary-light);
  cursor: pointer;
  font-size: 12px;
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}

.agent-item:hover:not(.disabled) {
  background: var(--bg-hover);
}

.agent-item.selected {
  background: rgba(99, 102, 241, 0.1);
}

.agent-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.active-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary-light);
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.offline-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.agent-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  color: var(--primary-light);
  flex-shrink: 0;
}

/* 底部 */
.panel-footer {
  padding: 10px 20px 14px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
}

/* 过渡动画 */
.agent-panel-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.agent-panel-leave-active {
  transition: all 0.2s ease;
}
.agent-panel-enter-from .agent-panel,
.agent-panel-leave-to .agent-panel {
  transform: translateY(100%);
  opacity: 0;
}
.agent-panel-enter-from,
.agent-panel-leave-to {
  opacity: 0;
}
</style>
