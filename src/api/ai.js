import request from './request'

/**
 * AI 对话接口（精简版，只有对话能力）
 * 文档：docs/backend/07-AI对话接口文档.md
 */

/** ① 我的会话列表（分页） */
export const getConversations = (params = { pageNum: 1, pageSize: 20 }) =>
  request.get('/ai/conversations', { params })

/** ② 某个会话的消息明细 */
export const getMessages = (convNo) =>
  request.get(`/ai/conversations/${encodeURIComponent(convNo)}/messages`)

/**
 * ③ 流式对话（SSE）
 * 不能用 EventSource：它只支持 GET 且无法携带 Authorization 头。
 * 这里用 fetch + ReadableStream 手动解析 text/event-stream。
 *
 * 事件顺序：meta → delta… → done，异常以 error 结束。
 *
 * @param {object} opts
 * @param {string} opts.message 必填，最长由后端 ai.chat.max-input-chars 控制（默认 4000）
 * @param {string|null} [opts.conversationNo] 首轮不传（新建会话），续聊传 meta 返回的会话号
 * @param {string} opts.token JWT
 * @param {(event:string, data:object)=>void} opts.onEvent
 * @param {AbortSignal} [opts.signal] 中断生成（后端会同步停止消费上游）
 */
export async function chatStream({ message, conversationNo, token, onEvent, signal }) {
  const body = { message }
  if (conversationNo) body.conversationNo = conversationNo

  const resp = await fetch('/api/v1/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  // 网关 40100 / 40002 等异常会以普通 JSON 返回
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
    buf = buf.replace(/\r\n/g, '\n') // 兼容 CRLF 换行的服务端实现

    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)

      let event = ''
      const dataLines = []
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) continue // 心跳注释帧（:ping），忽略
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (!dataLines.length) continue

      let data
      try {
        data = JSON.parse(dataLines.join('\n'))
      } catch {
        continue // 单个坏帧不影响整体流
      }

      // 后端部分错误（如 40002）不带 event 行，只有一个裸 data 帧。
      // 这类帧统一归一化成 error 事件，交给上层按错误处理。
      if (!event || event === 'message') {
        if (data && data.code !== undefined && data.code !== 0) {
          onEvent('error', { code: data.code, message: data.message })
        }
        continue
      }

      onEvent(event, data)
    }
  }
}
