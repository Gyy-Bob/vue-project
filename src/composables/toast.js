// 极简全局 toast（无第三方依赖）
import { reactive } from 'vue'

export const toastState = reactive({ list: [] })
let seq = 0

function push(type, text, duration = 3000) {
  const id = ++seq
  toastState.list.push({ id, type, text })
  setTimeout(() => {
    const i = toastState.list.findIndex((t) => t.id === id)
    if (i > -1) toastState.list.splice(i, 1)
  }, duration)
}

export const toast = {
  success: (t) => push('success', t),
  error: (t) => push('error', t, 4000),
  warning: (t) => push('warning', t, 4000),
  info: (t) => push('info', t),
}
