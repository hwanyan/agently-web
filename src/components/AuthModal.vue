<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-box">
        <!-- Logo -->
        <div class="modal-logo">
          <div class="modal-logo-icon">A</div>
          <div class="modal-logo-glow"></div>
        </div>

        <!-- 标题 -->
        <h2 class="modal-title">{{ isLogin ? '欢迎回来' : '创建账号' }}</h2>
        <p class="modal-subtitle">{{ isLogin ? '登录后对话记录永久保存' : '注册后即可开始对话，记录永久保存' }}</p>

        <!-- 表单 -->
        <form class="auth-form" @submit.prevent="handleSubmit">
          <!-- 注册额外字段 -->
          <template v-if="!isLogin">
            <div class="field-group">
              <label class="field-label">昵称 <span class="optional">（可选）</span></label>
              <input
                v-model="form.nickname"
                class="field-input"
                type="text"
                placeholder="你的昵称"
                autocomplete="nickname"
              />
            </div>
            <div class="field-group">
              <label class="field-label">邮箱</label>
              <input
                v-model="form.email"
                class="field-input"
                :class="{ error: errors.email }"
                type="email"
                placeholder="your@email.com"
                autocomplete="email"
              />
              <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
            </div>
          </template>

          <div class="field-group">
            <label class="field-label">用户名{{ isLogin ? ' / 邮箱' : '' }}</label>
            <input
              v-model="form.username"
              class="field-input"
              :class="{ error: errors.username }"
              type="text"
              :placeholder="isLogin ? '用户名或邮箱' : '3-64位字母/数字/下划线'"
              autocomplete="username"
            />
            <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
          </div>

          <div class="field-group">
            <label class="field-label">密码</label>
            <div class="password-wrapper">
              <input
                v-model="form.password"
                class="field-input"
                :class="{ error: errors.password }"
                :type="showPwd ? 'text' : 'password'"
                :placeholder="isLogin ? '输入密码' : '至少 6 位'"
                autocomplete="current-password"
              />
              <button type="button" class="pwd-toggle" @click="showPwd = !showPwd">
                <svg v-if="!showPwd" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8C1 8 3.5 3 8 3s7 5 7 5-2.5 5-7 5S1 8 1 8Z" stroke="currentColor" stroke-width="1.4"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2L14 14M6.5 6.7A2 2 0 0 0 9.3 9.5M4.2 4.4C2.8 5.4 1.8 6.8 1 8c0 0 2.5 5 7 5a6.8 6.8 0 0 0 3.8-1.2M7 3.1C7.3 3 7.7 3 8 3c4.5 0 7 5 7 5a12 12 0 0 1-1.5 2.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
          </div>

          <!-- 全局错误 -->
          <div v-if="globalError" class="global-error">
            <span>⚠</span>
            <span>{{ globalError }}</span>
          </div>

          <!-- 提交按钮 -->
          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="btn-spinner"></span>
            <span>{{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}</span>
          </button>
        </form>

        <!-- 切换登录/注册 -->
        <div class="switch-mode">
          <span>{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
          <button class="switch-btn" @click="toggleMode">{{ isLogin ? '立即注册' : '去登录' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { login, register, setToken, setStoredUser } from '../api.js'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close', 'success'])

const isLogin = ref(true)
const showPwd = ref(false)
const loading = ref(false)
const globalError = ref('')

const form = reactive({ username: '', email: '', password: '', nickname: '' })
const errors = reactive({ username: '', email: '', password: '' })

watch(() => props.visible, (v) => {
  if (v) resetForm()
})

function resetForm() {
  form.username = ''
  form.email = ''
  form.password = ''
  form.nickname = ''
  errors.username = ''
  errors.email = ''
  errors.password = ''
  globalError.value = ''
  showPwd.value = false
}

function toggleMode() {
  isLogin.value = !isLogin.value
  resetForm()
}

function validate() {
  let ok = true
  errors.username = ''
  errors.email = ''
  errors.password = ''

  if (!form.username.trim()) {
    errors.username = '请输入用户名'
    ok = false
  } else if (!isLogin.value && !/^[a-zA-Z0-9_-]{3,64}$/.test(form.username)) {
    errors.username = '3-64位，只允许字母、数字、下划线、连字符'
    ok = false
  }

  if (!isLogin.value) {
    if (!form.email.trim()) {
      errors.email = '请输入邮箱'
      ok = false
    } else if (!form.email.includes('@') || !form.email.includes('.')) {
      errors.email = '邮箱格式不正确'
      ok = false
    }
  }

  if (!form.password) {
    errors.password = '请输入密码'
    ok = false
  } else if (!isLogin.value && form.password.length < 6) {
    errors.password = '密码至少 6 位'
    ok = false
  }

  return ok
}

async function handleSubmit() {
  if (!validate()) return
  loading.value = true
  globalError.value = ''
  try {
    let data
    if (isLogin.value) {
      data = await login({ username: form.username, password: form.password })
    } else {
      data = await register({
        username: form.username,
        email: form.email,
        password: form.password,
        nickname: form.nickname
      })
    }
    setToken(data.token)
    setStoredUser(data.user)
    emit('success', data.user)
  } catch (e) {
    globalError.value = e.message || '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  padding: 20px;
}

.modal-box {
  width: 100%;
  max-width: 400px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 32px 28px 24px;
  box-shadow: var(--shadow-lg), 0 0 60px rgba(99, 102, 241, 0.12);
}

/* Logo */
.modal-logo {
  position: relative;
  width: 56px;
  height: 56px;
  margin: 0 auto 20px;
}

.modal-logo-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 800;
  color: white;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  position: relative;
  z-index: 1;
}

.modal-logo-glow {
  position: absolute;
  inset: -8px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
  border-radius: 50%;
}

.modal-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.modal-subtitle {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 24px;
}

/* 表单 */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.optional {
  font-weight: 400;
  color: var(--text-muted);
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.field-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.field-input.error {
  border-color: rgba(239, 68, 68, 0.5);
}

.field-input::placeholder {
  color: var(--text-muted);
}

.password-wrapper {
  position: relative;
}

.password-wrapper .field-input {
  padding-right: 38px;
}

.pwd-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color var(--transition);
}

.pwd-toggle:hover {
  color: var(--text-secondary);
}

.field-error {
  font-size: 11px;
  color: #f87171;
}

.global-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: #f87171;
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
  transition: opacity var(--transition), box-shadow var(--transition);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.35);
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* 切换模式 */
.switch-mode {
  text-align: center;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.switch-btn {
  background: none;
  border: none;
  color: var(--primary-light);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 0 2px;
  transition: color var(--transition);
}

.switch-btn:hover {
  color: white;
}

/* 游客模式 */
.guest-tip {
  text-align: center;
  margin-top: 10px;
}

.guest-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
}

.guest-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

/* 过渡动画 */
.modal-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: scale(0.92) translateY(10px);
  opacity: 0;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
