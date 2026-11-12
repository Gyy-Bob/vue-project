import request from './request'

/** ① 智能体信息 + 表单 schema（进页面调用一次） */
export const getAgent = (agentCode) => request.get(`/ai/agents/${encodeURIComponent(agentCode)}`)

/** ④ 单独获取表单 schema（可选） */
export const getForm = (formKey) => request.get(`/ai/forms/${encodeURIComponent(formKey)}`)

/** ③ 提交表单（clientToken 幂等） */
export const submitForm = (formKey, payload) =>
  request.post(`/ai/forms/${encodeURIComponent(formKey)}/submit`, payload)

/** ⑤ 历史会话列表 */
export const getConversations = (params = { pageNum: 1, pageSize: 20 }) =>
  request.get('/ai/conversations', { params })

/** ⑥ 会话消息明细 */
export const getMessages = (conversationNo) =>
  request.get(`/ai/conversations/${encodeURIComponent(conversationNo)}/messages`)

/**
 * ② 流式对话（SSE）
 * 不能用 EventSource：它只支持 GET 且无法携带 Authorization 头。
 * 这里用 fetch + ReadableStream 手动解析 text/event-stream。
 *
 * @param {object} opts
 * @param {string|null} opts.conversationNo 首轮 null
 * @param {string} opts.message
 * @param {{formKey:string, values:object}|null} opts.formContext 表单当前值，强烈建议每次传
 * @param {string} opts.token JWT
 * @param {(event:string, data:object)=>void} opts.onEvent
 * @param {AbortSignal} [opts.signal] 用于中断生成
 */
export async function chatStream({
  conversationNo,
  message,
  formContext,
  token,
  onEvent,
  signal,
  agentCode = 'user-onboarding',
}) {
  const resp = await fetch('/api/v1/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationNo: conversationNo || null,
      agentCode,
      message,
      formContext: formContext || null,
    }),
    signal,
  })

  // 网关 40100 等异常会以普通 JSON 返回（HTTP 200）
  const contentType = resp.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const json = await resp.json().catch(() => ({}))
    throw { code: json.code ?? resp.status, message: json.message || `请求失败（HTTP ${resp.status}）` }
  }

  if (!resp.ok || !resp.body) throw { code: resp.status, message: `服务异常（HTTP ${resp.status}）` }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)

      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) continue // 心跳注释帧（:ping）
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        onEvent(event, JSON.parse(data))
      } catch {
        // 单个坏帧不影响整体流
      }
    }
  }
}
