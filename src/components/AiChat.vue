<template>
  <div class="ai-chat">
    <!-- 左：会话历史 -->
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
      </div>
    </aside>

    <!-- 中：对话区 -->
    <section class="ai-main">
      <header class="ai-head">
        <div class="ai-agent">
          <div class="ai-avatar">{{ agentInitial }}</div>
          <div>
            <div class="ai-name">{{ agentInfo?.agentName || 'AI 助手' }}</div>
            <div class="ai-status">
              <span class="dot" :class="{ busy: streaming }"></span>
              {{ streaming ? '正在输入…' : '在线' }}
            </div>
          </div>
        </div>
        <button v-if="streaming" class="ai-stop" @click="stopStreaming">■ 停止生成</button>
      </header>

      <div ref="msgBoxRef" class="ai-messages">
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

      <div v-if="quickReplies.length && messages.length <= 1 && !streaming" class="ai-quick">
        <button v-for="q in quickReplies" :key="q" class="ai-quick-btn" @click="send(q)">{{ q }}</button>
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

    <!-- 右：AI 回填表单 -->
    <aside v-if="formSchema" class="ai-form-panel">
      <div class="ai-form-head">
        <span>{{ formSchema.formName }}</span>
        <span class="ai-form-badge">AI 自动回填</span>
      </div>

      <div class="ai-form-body">
        <div
          v-for="f in formSchema.fields"
          :key="f.key"
          class="ai-field"
          :class="{ patched: patchedFields.includes(f.key) }"
        >
          <label>
            {{ f.label }}
            <em v-if="f.required">*</em>
          </label>

          <input
            v-if="f.type === 'text'"
            v-model="formValues[f.key]"
            class="input ai-input-sm"
            type="text"
            :placeholder="f.placeholder || ''"
            :maxlength="f.maxLength || 200"
          />
          <input
            v-else-if="f.type === 'password'"
            v-model="formValues[f.key]"
            class="input ai-input-sm"
            type="password"
            :placeholder="f.placeholder || ''"
            :maxlength="f.maxLength || 64"
          />
          <input
            v-else-if="f.type === 'number'"
            v-model.number="formValues[f.key]"
            class="input ai-input-sm"
            type="number"
            :min="f.min"
            :max="f.max"
          />
          <input
            v-else-if="f.type === 'date'"
            v-model="formValues[f.key]"
            class="input ai-input-sm"
            type="date"
          />
          <textarea
            v-else-if="f.type === 'textarea'"
            v-model="formValues[f.key]"
            class="input ai-textarea-sm"
            rows="3"
            :placeholder="f.placeholder || ''"
            :maxlength="f.maxLength || 500"
          ></textarea>
          <select v-else-if="f.type === 'select'" v-model="formValues[f.key]" class="input ai-input-sm">
            <option value="">请选择</option>
            <option v-for="o in f.options || []" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <div v-else-if="f.type === 'radio'" class="ai-radio-group">
            <label v-for="o in f.options || []" :key="o.value" class="ai-radio">
              <input v-model="formValues[f.key]" type="radio" :value="o.value" /> {{ o.label }}
            </label>
          </div>

          <div v-if="fieldErrors[f.key]" class="field-error">{{ fieldErrors[f.key] }}</div>
          <div v-else-if="f.hint" class="ai-field-hint">{{ f.hint }}</div>
        </div>
      </div>

      <div class="ai-form-foot">
        <button class="btn-gold" :disabled="submitting || submitted" @click="submit">
          {{ submitted ? '已提交' : submitting ? '提交中…' : '提交表单' }}
        </button>
        <div v-if="submitted" class="ai-form-success">✓ 提交成功（编号 #{{ submissionId }}）</div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { chatStream, getAgent, getConversations, getForm, getMessages, submitForm } from '@/api/ai'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/toast'

const AGENT_CODE = 'user-onboarding'

const router = useRouter()
const userStore = useUserStore()

const agentInfo = ref(null)
const messages = ref([])
const draft = ref('')
const streaming = ref(false)
const conversationNo = ref(null)
const formSchema = ref(null)
const formValues = reactive({})
const fieldErrors = reactive({})
const patchedFields = ref([])
const submitting = ref(false)
const submitted = ref(false)
const submissionId = ref(null)
const clientToken = ref(newUuid())
const conversations = ref([])
const msgBoxRef = ref(null)
let controller = null
const patchTimers = {}

const quickReplies = computed(() => agentInfo.value?.quickReplies || [])
const agentInitial = computed(() => (agentInfo.value?.agentName || 'AI').slice(0, 1))

function newUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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

/* ---------- 初始化 ---------- */
async function loadAgent() {
  try {
    const data = await getAgent(AGENT_CODE)
    agentInfo.value = data
    if (data.forms?.length) initForm(data.forms[0])
    messages.value = [{ role: 'assistant', content: data.welcomeMsg || '你好，我是 AI 助手。' }]
  } catch (err) {
    // 50600 智能体不存在/停用
    toast.error(err.message || '智能体加载失败')
    messages.value = [{ role: 'assistant', content: `智能体暂不可用：${err.message || ''}`, error: false }]
  }
}

async function loadConversations() {
  try {
    const list = await getConversations({ pageNum: 1, pageSize: 20 })
    conversations.value = Array.isArray(list) ? list : list?.list || []
  } catch {
    // 会话列表失败不阻塞主流程
  }
}

function initForm(schema) {
  formSchema.value = schema
  Object.keys(formValues).forEach((k) => delete formValues[k])
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  schema?.fields?.forEach((f) => {
    formValues[f.key] = f.type === 'number' ? null : ''
  })
  submitted.value = false
  submissionId.value = null
  clientToken.value = newUuid()
}

/* ---------- 发送消息 ---------- */
function onEnter() {
  if (!streaming.value) send(draft.value)
}

async function send(text, { retry = false } = {}) {
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

  controller = new AbortController()
  try {
    await chatStream({
      conversationNo: conversationNo.value,
      message: content,
      formContext: formSchema.value
        ? { formKey: formSchema.value.formKey, values: { ...formValues } }
        : null,
      token: userStore.token,
      signal: controller.signal,
      onEvent: (event, data) => handleEvent(event, data, bubble),
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
    // 50603：会话失效 → 清空会话号按新会话重发一次
    if (err?.code === 50603) {
      conversationNo.value = null
      const idx = messages.value.indexOf(bubble)
      if (idx > -1) messages.value.splice(idx, 1)
      toast.info('会话已失效，已重新开始')
      send(content, { retry: true })
      return
    }
    bubble.error = true
    bubble.content += (bubble.content ? '\n' : '') + `[${err?.message || '连接失败'}]`
  } finally {
    streaming.value = false
  }
}

function handleEvent(event, data, bubble) {
  switch (event) {
    case 'meta':
      conversationNo.value = data.conversationNo
      break
    case 'form':
      if (!formSchema.value) initForm(data)
      break
    case 'delta':
      bubble.content += data.text || ''
      scrollBottom()
      break
    case 'patch':
      formValues[data.field] = data.value
      delete fieldErrors[data.field]
      highlightField(data.field)
      break
    case 'done':
      streaming.value = false
      loadConversations()
      break
    case 'error':
      streaming.value = false
      bubble.error = true
      bubble.content += (bubble.content ? '\n' : '') + `[${data.message || '生成失败'}]`
      break
  }
}

// 被 AI 回填的字段高亮 1.8 秒
function highlightField(key) {
  if (!patchedFields.value.includes(key)) patchedFields.value.push(key)
  clearTimeout(patchTimers[key])
  patchTimers[key] = setTimeout(() => {
    patchedFields.value = patchedFields.value.filter((k) => k !== key)
  }, 1800)
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

/* ---------- 表单提交 ---------- */
async function submit() {
  if (!formSchema.value) return
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])

  for (const f of formSchema.value.fields) {
    const v = formValues[f.key]
    if (f.required && (v === '' || v === null || v === undefined)) {
      fieldErrors[f.key] = `请填写${f.label}`
    }
  }
  if (Object.keys(fieldErrors).length) {
    toast.warning('请先完善必填项')
    return
  }

  submitting.value = true
  try {
    const values = { ...formValues }
    Object.keys(values).forEach((k) => {
      if (values[k] === '' || values[k] === null) delete values[k]
    })
    const res = await submitForm(formSchema.value.formKey, {
      conversationNo: conversationNo.value,
      clientToken: clientToken.value,
      values,
    })
    submitted.value = true
    submissionId.value = res.submissionId
    toast.success('表单提交成功')
    messages.value.push({
      role: 'assistant',
      content: `✓ 表单已提交成功（编号 #${res.submissionId}，提交时间 ${res.submittedAt}）。`,
    })
    scrollBottom()
  } catch (err) {
    if (err?.code === 40002 && err.data?.fieldErrors) {
      Object.assign(fieldErrors, err.data.fieldErrors)
      toast.error(err.message || '表单校验未通过')
    } else if (err?.code === 50606) {
      // 幂等：重复提交视为成功
      submitted.value = true
      toast.info('该表单已提交过，无需重复操作')
    } else if (err?.code === 40100) {
      userStore.logout()
      toast.error('登录已过期，请重新登录')
      router.push({ name: 'login' })
    } else {
      toast.error(err?.message || '提交失败')
    }
  } finally {
    submitting.value = false
  }
}

/* ---------- 会话管理 ---------- */
function newConversation() {
  if (streaming.value) return
  conversationNo.value = null
  messages.value = agentInfo.value
    ? [{ role: 'assistant', content: agentInfo.value.welcomeMsg || '你好' }]
    : []
  if (formSchema.value) initForm(formSchema.value)
  draft.value = ''
}

async function openConversation(c) {
  if (streaming.value) return
  conversationNo.value = c.conversationNo
  messages.value = []
  if (formSchema.value) initForm(formSchema.value)
  try {
    let list = await getMessages(c.conversationNo)
    // 兼容 data 直接为数组或分页对象
    if (!Array.isArray(list)) list = list?.list || []
    messages.value = list.map((m) => ({ role: m.role, content: m.content, error: false }))

    // 用 patches 重建表单已填值（patches 是 JSON 字符串）
    for (const m of list) {
      if (!m.patches) continue
      try {
        const patches = JSON.parse(m.patches)
        for (const p of patches || []) {
          formValues[p.field] = p.value
        }
      } catch {
        // 忽略坏数据
      }
    }
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

onMounted(async () => {
  await loadAgent()
  // 若接口①未返回表单，再兜底按 formKey 拉一次 schema
  if (!formSchema.value) {
    try {
      const schema = await getForm('user_register')
      if (schema) initForm(schema)
    } catch {
      // 表单不可用时仅使用对话功能
    }
  }
  loadConversations()
})
</script>
