<template>
  <div class="auth-page">
    <!-- 左侧品牌区（设计稿第 2 页左屏） -->
    <div class="auth-brand">
      <div class="logo">
        <span class="logo-mark"></span>
        <span>AURORA · 云启科技</span>
      </div>
      <div class="slogan">
        <h1>从这里开始<br />共赴每一场成就</h1>
        <p>三分钟即可完成注册，即刻体验更智能的企业管理方式。</p>
      </div>
      <div class="copyright">© 2026 AURORA 云启科技 · 保留所有权利</div>
    </div>

    <!-- 右侧注册表单 -->
    <div class="auth-panel">
      <div class="auth-box">
        <h2>创建账户</h2>
        <p class="sub">填写以下信息，开启您的旅程</p>

        <div v-if="errorMsg" class="form-error">⚠ {{ errorMsg }}</div>

        <form @submit.prevent="handleRegister">
          <div class="field">
            <div class="input-wrap">
              <i class="icon">👤</i>
              <input
                v-model.trim="form.userName"
                class="input"
                :class="{ invalid: !!fieldError.userName }"
                type="text"
                placeholder="请输入用户名（2-50 字符，仅中文/字母/数字/下划线）"
                autocomplete="off"
              />
            </div>
            <div v-if="fieldError.userName" class="field-error">{{ fieldError.userName }}</div>
          </div>

          <div class="field">
            <div class="input-wrap">
              <i class="icon">🔒</i>
              <input
                v-model="form.password"
                class="input"
                :class="{ invalid: !!fieldError.password }"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请设置密码（8-32 位，须包含字母和数字）"
                autocomplete="new-password"
              />
              <span class="toggle-eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁' }}</span>
            </div>
            <div v-if="fieldError.password" class="field-error">{{ fieldError.password }}</div>
          </div>

          <div class="field">
            <div class="input-wrap">
              <i class="icon">🛡</i>
              <input
                v-model="form.confirmPassword"
                class="input"
                :class="{ invalid: !!fieldError.confirmPassword }"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请再次输入密码"
                autocomplete="new-password"
              />
            </div>
            <div v-if="fieldError.confirmPassword" class="field-error">{{ fieldError.confirmPassword }}</div>
          </div>

          <div class="row-between">
            <label class="checkbox">
              <input v-model="agreed" type="checkbox" />
              我已阅读并同意《服务条款》与《隐私政策》
            </label>
          </div>

          <button class="btn-gold" type="submit" :disabled="loading">
            {{ loading ? '注册中…' : '注　册' }}
          </button>
        </form>

        <div class="switch-tip">
          已有账户？<span class="link" @click="goLogin">返回登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/api/auth'
import { toast } from '@/composables/toast'

const router = useRouter()

const form = reactive({ userName: '', password: '', confirmPassword: '' })
const fieldError = reactive({ userName: '', password: '', confirmPassword: '' })
const errorMsg = ref('')
const showPwd = ref(false)
const agreed = ref(false)
const loading = ref(false)

// 与后端校验规则保持一致（04-业务逻辑文档 1.2）
const USER_NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,50}$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*_.+-]{8,32}$/

function validate() {
  fieldError.userName = ''
  fieldError.password = ''
  fieldError.confirmPassword = ''
  errorMsg.value = ''

  if (!form.userName) {
    fieldError.userName = '请输入用户名'
  } else if (!USER_NAME_RE.test(form.userName)) {
    fieldError.userName = '用户名须为 2-50 字符，仅限中文、字母、数字、下划线'
  }
  if (!form.password) {
    fieldError.password = '请设置密码'
  } else if (!PASSWORD_RE.test(form.password)) {
    fieldError.password = '密码须 8-32 位，且同时包含字母和数字'
  }
  if (!form.confirmPassword) {
    fieldError.confirmPassword = '请再次输入密码'
  } else if (form.confirmPassword !== form.password) {
    fieldError.confirmPassword = '两次输入的密码不一致'
  }
  if (!agreed.value) {
    errorMsg.value = '请先阅读并同意《服务条款》与《隐私政策》'
    return false
  }
  return !fieldError.userName && !fieldError.password && !fieldError.confirmPassword
}

async function handleRegister() {
  errorMsg.value = ''
  if (!validate()) return
  loading.value = true
  try {
    const data = await register({
      userName: form.userName,
      password: form.password,
    })
    // 注册成功：跳回登录页进行登录（不自动登录，见业务文档 1.1 规则 3）
    toast.success(`注册成功！账号 ${data.userName}，请登录`)
    router.push({
      name: 'login',
      query: { userName: data.userName },
    })
  } catch (err) {
    errorMsg.value = err.message
    if (err.code === 40901) {
      // 用户名已被注册：清空并聚焦用户名输入框
      fieldError.userName = err.message
      form.userName = ''
    }
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push({ name: 'login' })
}
</script>
