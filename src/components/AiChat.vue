<template>
  <div class="ai-chat">
    <!-- 左：会话记录 -->
    <aside class="ai-side">
      <div class="ai-side-head">
        <span>会话记录</span>
        <button class="ai-new-btn" @click="newConversation">+ 新对话</button>
      </div>
      <div class="ai-conv-list">
        <div v-if="!conversations.length" class="ai-conv-empty">暂无历史会话</div>
        <div
          v-for="c in conversations"
          :key="c.conversationNo"
          class="ai-conv-item"
          :class="{ active: c.conversationNo === conversationNo }"
          @click="openConversation(c)"
        >
          <div class="ai-conv-title">{{ c.title || '新会话' }}</div>
          <div class="ai-conv-meta">{{ c.messageCount }} 条 · {{ fmtTime(c.createdAt) }}</div>
        </div>
        <button v-if="convHasMore" class="ai-more-btn" :disabled="convLoading" @click="loadMoreConversations">
          {{ convLoading ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </aside>

    <!-- 右：对话区 -->
    <section class="ai-main">
      <header class="ai-head">
        <div class="ai-agent">
          <div class="ai-avatar">AI</div>
          <div>
            <div class="ai-name">AI 助手</div>
            <div class="ai-status">
              <span class="dot" :class="{ busy: streaming }"></span>
              {{ streaming ? '正在输入…' : '在线' }}
            </div>
          </div>
        </div>
        <button v-if="streaming" class="ai-stop" @click="stopStreaming">■ 停止生成</button>
      </header>

      <div ref="msgBoxRef" class="ai-messages">
        <div v-if="!messages.length" class="ai-empty">发送一条消息开始对话</div>

        <div v-for="(m, i) in messages" :key="i" class="ai-msg" :class="m.role">
          <div class="ai-bubble" :class="{ 'is-error': m.error }">
            <span
              v-if="m.role === 'assistant' && !m.content && streaming && i === messages.length - 1"
              class="typing"
            ><i></i><i></i><i></i></span>
            <template v-else>{{ m.content }}</template>
            <div v-if="m.error" class="ai-retry">
              <button @click="retry(m)">重试</button>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-input">
        <textarea
          v-model="draft"
          class="ai-textarea"
          rows="2"
          maxlength="4000"
          placeholder="输入消息，Enter 发送，Shift + Enter 换行"
          :disabled="streaming"
          @keydown.enter.exact.prevent="onEnter"
        ></textarea>
        <button class="btn-gold ai-send" :disabled="streaming || !draft.trim()" @click="send(draft)">
          {{ streaming ? '生成中…' : '发送' }}
        </button>
      </div>
      <div class="ai-hint">Enter 发送 · Shift + Enter 换行 · 单条最多 4000 字</div>
    </section>
  </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { chatStream, getConversations, getMessages } from '@/api/ai'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/toast'

const router = useRouter()
const userStore = useUserStore()

const messages = ref([])
const draft = ref('')
const streaming = ref(false)
const conversationNo = ref(null)
const conversations = ref([])
const convPage = ref(1)
const convHasMore = ref(false)
const convLoading = ref(false)
const CONV_PAGE_SIZE = 20
const msgBoxRef = ref(null)
let controller = null

// 错误码 → 前端友好提示（后端 message 过于技术化时兜底）
const ERR_TEXT = {
  40002: '消息内容不合法',
  50601: 'AI 服务异常，请稍后重试',
  50602: '响应超时（单次最长 120 秒），请重试',
  50603: '会话不存在',
  50608: '输入内容过长，请精简后重试',
}

function errText(code, message) {
  if (ERR_TEXT[code]) return ERR_TEXT[code]
  return message || '生成失败'
}

function fmtTime(t) {
  if (!t) return ''
  const d = new Date(String(t).replace('T', ' ').replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return t
  const p = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function scrollBottom() {
  nextTick(() => {
    const el = msgBoxRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/* ---------- 会话列表 ---------- */
async function loadConversations({ append = false } = {}) {
  convLoading.value = true
  try {
    const list = await getConversations({ pageNum: convPage.value, pageSize: CONV_PAGE_SIZE })
    const arr = Array.isArray(list) ? list : list?.list || []
    conversations.value = append ? [...conversations.value, ...arr] : arr
    // 后端不返回总数，用「返回条数是否等于 pageSize」判断还有没有下一页
    convHasMore.value = arr.length === CONV_PAGE_SIZE
  } catch {
    // 会话列表失败不影响对话
  } finally {
    convLoading.value = false
  }
}

function loadMoreConversations() {
  if (!convHasMore.value || convLoading.value) return
  convPage.value += 1
  loadConversations({ append: true })
}

/* ---------- 发送消息 ---------- */
function onEnter() {
  if (!streaming.value) send(draft.value)
}

async function send(text, { retry = false, retried = false } = {}) {
  const content = String(text || '').trim()
  if (!content || streaming.value) return
  if (content.length > 4000) {
    toast.warning('单条消息不能超过 4000 字')
    return
  }

  if (!retry) messages.value.push({ role: 'user', content })
  const bubble = reactive({ role: 'assistant', content: '', error: false, failedText: content })
  messages.value.push(bubble)
  draft.value = ''
  streaming.value = true
  scrollBottom()

  // ctx.needRetry：流内收到 50603 时，等连接结束后按新会话重发一次（只重试一次，避免死循环）
  const ctx = { retried, needRetry: false }

  controller = new AbortController()
  try {
    await chatStream({
      conversationNo: conversationNo.value,
      message: content,
      token: userStore.token,
      signal: controller.signal,
      onEvent: (event, data) => handleEvent(event, data, bubble, ctx),
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (!bubble.content) bubble.content = '（已停止生成）'
      return
    }
    streaming.value = false
    if (err?.code === 40100) {
      userStore.logout()
      toast.error('登录已过期，请重新登录')
      router.push({ name: 'login' })
      return
    }
    // 50603：会话不存在 / 不属于当前用户 → 清掉会话号，按新会话重发一次
    if (err?.code === 50603 && !ctx.retried) {
      ctx.needRetry = true
    } else {
      bubble.error = true
      bubble.content += (bubble.content ? '\n' : '') + `[${errText(err?.code, err?.message)}]`
    }
  } finally {
    streaming.value = false
    if (ctx.needRetry) {
      conversationNo.value = null
      const idx = messages.value.indexOf(bubble)
      if (idx > -1) messages.value.splice(idx, 1)
      toast.info('会话已失效，已自动重新开始')
      send(content, { retry: true, retried: true })
    }
  }
}

function handleEvent(event, data, bubble, ctx) {
  switch (event) {
    case 'meta':
      conversationNo.value = data.conversationNo
      break
    case 'delta':
      bubble.content += data.text || ''
      scrollBottom()
      break
    case 'done':
      streaming.value = false
      convPage.value = 1
      loadConversations()
      break
    case 'error':
      streaming.value = false
      // 50603 会话失效：清掉会话号，首次自动重开一轮
      if (data.code === 50603) {
        conversationNo.value = null
        if (!ctx.retried) {
          ctx.needRetry = true
          break
        }
      }
      bubble.error = true
      bubble.content += (bubble.content ? '\n' : '') + `[${errText(data.code, data.message)}]`
      break
  }
}

function stopStreaming() {
  controller?.abort()
  streaming.value = false
}

function retry(m) {
  const idx = messages.value.indexOf(m)
  if (idx > -1) messages.value.splice(idx, 1)
  send(m.failedText, { retry: true })
}

/* ---------- 会话切换 ---------- */
function newConversation() {
  if (streaming.value) return
  conversationNo.value = null
  messages.value = []
  draft.value = ''
}

async function openConversation(c) {
  if (streaming.value) return
  conversationNo.value = c.conversationNo
  messages.value = []
  try {
    let list = await getMessages(c.conversationNo)
    if (!Array.isArray(list)) list = list?.list || []
    messages.value = list.map((m) => ({ role: m.role, content: m.content, error: false }))
    scrollBottom()
  } catch (err) {
    if (err?.code === 50603) {
      toast.info('该会话已失效')
      newConversation()
    } else {
      toast.error(err?.message || '加载会话失败')
    }
  }
}

onMounted(() => {
  loadConversations()
})
</script>
