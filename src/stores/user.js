import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'aurora_user'

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export const useUserStore = defineStore('user', () => {
  const saved = readStorage()
  const token = ref(saved.token || '')
  const userId = ref(saved.userId ?? null)
  const userName = ref(saved.userName || '')
  const expiresIn = ref(saved.expiresIn || 0)

  const isLogin = computed(() => !!token.value)

  function setLogin(data) {
    // data: { token, expiresIn, userId, userName }
    token.value = data.token
    userId.value = data.userId
    userName.value = data.userName
    expiresIn.value = data.expiresIn || 7200
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: token.value,
        userId: userId.value,
        userName: userName.value,
        expiresIn: expiresIn.value,
      })
    )
  }

  function logout() {
    token.value = ''
    userId.value = null
    userName.value = ''
    expiresIn.value = 0
    localStorage.removeItem(STORAGE_KEY)
  }

  return { token, userId, userName, expiresIn, isLogin, setLogin, logout }
})
