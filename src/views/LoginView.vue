<template>
  <div class="auth-page">
    <!-- 左侧品牌区（设计稿第 1 页左屏 · 原始背景图） -->
    <div class="auth-brand" :style="{ backgroundImage: `url(${bgLogin})` }">
      <div class="logo">
        <span class="logo-mark"></span>
        <span>AURORA · 涌原科技</span>
      </div>
      <div class="slogan">
        <h1>智启未来<br />高效管理每一刻</h1>
        <p>一站式企业业务管理平台，让协作更简单，让决策更智能。</p>
      </div>
      <div class="copyright">© 2026 AURORA 涌原科技 · 保留所有权利</div>
    </div>

    <!-- 右侧登录表单 -->
    <div class="auth-panel">
      <div class="auth-box">
        <h2>欢迎回来</h2>
        <p class="sub">登录您的账户，开启高效的一天</p>

        <div v-if="errorMsg" class="form-error">⚠ {{ errorMsg }}</div>

        <form @submit.prevent="handleLogin">
          <div class="field">
            <div class="input-wrap">
              <i class="icon">👤</i>
              <input
                v-model.trim="form.userName"
                class="input"
                :class="{ invalid: !!fieldError.userName }"
                type="text"
                placeholder="请输入账号"
                autocomplete="username"
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
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <span class="toggle-eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁' }}</span>
            </div>
            <div v-if="fieldError.password" class="field-error">{{ fieldError.password }}</div>
          </div>

          <div class="row-between">
            <label class="checkbox">
              <input v-model="rememberMe" type="checkbox" /> 记住我
            </label>
            <!-- 设计稿装饰元素，一期不实现 -->
            <span>忘记密码？</span>
          </div>

          <button class="btn-gold" type="submit" :disabled="loading">
            {{ loading ? '登录中…' : '登　录' }}
          </button>
        </form>

        <div class="switch-tip">
          还没有账号？<span class="link" @click="goRegister">立即注册</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/toast'
import bgLogin from '@/assets/images/auth-bg-login.jpg'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  // 注册成功跳回时预填用户名
  userName: String(route.query.userName || ''),
  password: '',
})
const fieldError = reactive({ userName: '', password: '' })
const errorMsg = ref('')
const showPwd = ref(false)
const rememberMe = ref(true)
const loading = ref(false)

function validate() {
  fieldError.userName = ''
  fieldError.password = ''
  if (!form.userName) {
    fieldError.userName = '请输入账号'
  } else if (form.userName.length < 2 || form.userName.length > 50) {
    fieldError.userName = '账号须为 2-50 个字符'
  }
  if (!form.password) {
    fieldError.password = '请输入密码'
  } else if (form.password.length < 8 || form.password.length > 32) {
    fieldError.password = '密码须为 8-32 位'
  }
  return !fieldError.userName && !fieldError.password
}

async function handleLogin() {
  errorMsg.value = ''
  if (!validate()) return
  loading.value = true
  try {
    const data = await login({ userName: form.userName, password: form.password })
    // 登录成功：存凭证 → 跳菜单页
    userStore.setLogin(data)
    toast.success(`欢迎回来，${data.userName}`)
    router.push(String(route.query.redirect || '/menu'))
  } catch (err) {
    // 登录失败：展示后端错误信息（40101/40302/40001/50000）
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}

function goRegister() {
  router.push({ name: 'register' })
}
</script>
