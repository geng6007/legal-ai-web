import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 120000,
  transformResponse: [
    (data) => {
      if (typeof data !== 'string') return data

      const safeJson = data.replace(
        /(^|[{,]\s*)("(?:id|sessionId)"\s*:\s*)(-?\d{16,})(?=\s*[,}])/gm,
        '$1$2"$3"',
      )
      try {
        return JSON.parse(safeJson)
      } catch {
        return data
      }
    },
  ],
})

client.interceptors.response.use((response) => {
  const payload = response.data
  if (payload && typeof payload.code === 'number' && payload.code !== 200) {
    return Promise.reject(new Error(payload.message || '请求失败，请稍后重试'))
  }
  return payload && Object.hasOwn(payload, 'data') ? payload.data : payload
})

export function getErrorMessage(error) {
  if (error?.response?.status === 502) {
    return '无法连接后端服务（localhost:8080），请先启动 legal-ai-backend 后重试。'
  }
  if (error?.response?.status === 503) {
    return '后端服务暂时不可用，请稍后重试。'
  }
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.message) return error.message
  return '请求失败，请稍后重试'
}

export async function streamAiOutput(endpoint, body, handlers = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`
    try {
      const payload = await response.json()
      if (payload?.message) message = payload.message
    } catch {
      if (response.status === 502) {
        message = '无法连接后端服务（localhost:8080），请先启动 legal-ai-backend 后重试。'
      }
    }
    throw new Error(message)
  }

  if (!response.body) throw new Error('当前浏览器不支持流式响应')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines = []
  let completed = false

  function dispatchEvent() {
    if (!dataLines.length) {
      eventName = 'message'
      return
    }

    const json = dataLines.join('\n').replace(
      /(^|[{,]\s*)("(?:id|sessionId)"\s*:\s*)(-?\d{16,})(?=\s*[,}])/gm,
      '$1$2"$3"',
    )
    const payload = JSON.parse(json)
    dataLines = []
    const currentEvent = eventName
    eventName = 'message'

    if (currentEvent === 'start') handlers.onStart?.(payload)
    if (currentEvent === 'token') handlers.onToken?.(payload.content || '')
    if (currentEvent === 'done') completed = true
    if (currentEvent === 'done') handlers.onDone?.(payload)
    if (currentEvent === 'error') throw new Error(payload.message || 'AI 回复失败，请稍后重试')
  }

  function processLine(line) {
    if (line === '') {
      dispatchEvent()
    } else if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) processLine(line)
      if (done) {
        if (buffer) processLine(buffer)
        dispatchEvent()
        break
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!completed) throw new Error('流式响应意外结束，请重试')
}

export function streamChatMessage(sessionId, content, onToken) {
  return streamAiOutput(
    `/api/chat/session/${encodeURIComponent(sessionId)}/message/stream`,
    { content },
    { onToken },
  )
}

export function streamConsultReport(sessionId, handlers) {
  return streamAiOutput(
    `/api/consult/session/${encodeURIComponent(sessionId)}/complete/stream`,
    {},
    handlers,
  )
}

export function streamContractReview(data, handlers) {
  return streamAiOutput('/api/contract/review/stream', data, handlers)
}

export function streamDocumentGeneration(data, handlers) {
  return streamAiOutput('/api/doc/generate/stream', data, handlers)
}

export const legalApi = {
  listChatSessions: () => client.get('/chat/sessions'),
  createChatSession: (data) => client.post('/chat/session', data),
  deleteChatSession: (id) => client.delete(`/chat/session/${id}`),
  getChatMessages: (id) => client.get(`/chat/session/${id}/messages`),
  sendChatMessage: (id, content) => client.post(`/chat/session/${id}/message`, { content }),

  createConsultSession: (scenarioCode) => client.post('/consult/session', { scenarioCode }),
  submitConsultAnswer: (id, step, answer) =>
    client.post(`/consult/session/${id}/answer`, { step, answer }),
  completeConsultSession: (id) => client.post(`/consult/session/${id}/complete`),

  createContractReview: (data) => client.post('/contract/review', data),
  listContractReviews: () => client.get('/contract/reviews'),
  getContractReview: (id) => client.get(`/contract/review/${id}`),

  listDocuments: () => client.get('/doc/list'),
  generateDocument: (data) => client.post('/doc/generate', data),

  listKnowledgeDocuments: (docType) =>
    client.get('/knowledge/documents', { params: docType ? { docType } : {} }),
  addKnowledgeDocument: (data) => client.post('/knowledge/document', data),
  uploadKnowledgePdf: ({ file, title, source, docType }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    if (source) formData.append('source', source)
    if (docType) formData.append('docType', docType)
    return client.post('/knowledge/document/pdf', formData)
  },
  deleteKnowledgeDocument: (id) => client.delete(`/knowledge/document/${id}`),
  searchKnowledge: (query, maxResults = 5) =>
    client.get('/knowledge/search', { params: { query, maxResults } }),
}
