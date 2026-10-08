<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { getErrorMessage, legalApi, streamChatMessage } from '@/api/legal'

const sessions = ref([])
const selectedSession = ref(null)
const messages = ref([])
const draft = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const messageList = ref(null)

const suggestions = ['试用期被辞退，公司需要支付补偿吗？', '租房押金到期后房东不退怎么办？', '签订合同前有哪些条款需要重点关注？']

function makeSessionTitle(content) {
  const text = typeof content === 'string' ? content.trim() : ''
  const characters = Array.from(text)
  const title = characters.slice(0, 20).join('')
  return title.length < characters.length ? `${title}...` : title
}

function legacySessionId(id) {
  const roundedId = Number(id)
  return Number.isFinite(roundedId) ? String(roundedId) : null
}

async function loadSessionMessages(session) {
  const messages = (await legalApi.getChatMessages(session.id)) || []
  if (messages.length) return messages

  const legacyId = legacySessionId(session.id)
  if (!legacyId || legacyId === String(session.id)) return messages
  return (await legalApi.getChatMessages(legacyId)) || []
}

async function loadSessions() {
  loading.value = true
  error.value = ''
  try {
    sessions.value = (await legalApi.listChatSessions()) || []
    await Promise.all(
      sessions.value
        .filter((session) => !session.title || session.title === '新会话')
        .map(async (session) => {
          const legacyId = legacySessionId(session.id)
          if (!legacyId || legacyId === String(session.id)) return
          const messages = await legalApi.getChatMessages(legacyId)
          const firstQuestion = messages.find((message) => message.role === 'user')?.content
          if (firstQuestion) session.title = makeSessionTitle(firstQuestion)
        }),
    )
    if (selectedSession.value) {
      selectedSession.value = sessions.value.find((item) => item.id === selectedSession.value.id) || null
    }
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function createSession(firstMessage) {
  error.value = ''
  try {
    const session = await legalApi.createChatSession({
      title: typeof firstMessage === 'string' && firstMessage.trim()
        ? makeSessionTitle(firstMessage)
        : '新会话',
    })
    selectedSession.value = session
    messages.value = []
    await loadSessions()
    selectedSession.value = sessions.value.find((item) => item.id === session.id) || session
  } catch (reason) {
    error.value = getErrorMessage(reason)
  }
}

async function openSession(session) {
  selectedSession.value = session
  error.value = ''
  try {
    messages.value = await loadSessionMessages(session)
    scrollToLatest()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  }
}

async function removeSession(session, event) {
  event.stopPropagation()
  if (!window.confirm(`确定删除“${session.title || '新会话'}”吗？`)) return
  try {
    await legalApi.deleteChatSession(session.id)
    if (selectedSession.value?.id === session.id) {
      selectedSession.value = null
      messages.value = []
    }
    await loadSessions()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  }
}

async function sendMessage(value = draft.value) {
  const content = value.trim()
  if (!content || sending.value) return
  error.value = ''
  try {
    if (!selectedSession.value) await createSession(content)
    if (!selectedSession.value) return
    messages.value.push({ role: 'user', content, id: `local-${Date.now()}` })
    draft.value = ''
    sending.value = true
    scrollToLatest()
    const assistantMessage = reactive({ role: 'assistant', content: '', id: `stream-${Date.now()}` })
    messages.value.push(assistantMessage)
    await streamChatMessage(selectedSession.value.id, content, (token) => {
      assistantMessage.content += token
      scrollToLatest()
    })
    await loadSessions()
    scrollToLatest()
  } catch (reason) {
    error.value = getErrorMessage(reason)
    const lastMessage = messages.value.at(-1)
    if (lastMessage?.id?.toString().startsWith('stream-') && !lastMessage.content) {
      messages.value.pop()
    }
    if (messages.value.at(-1)?.id?.toString().startsWith('local-')) {
      messages.value.pop()
      draft.value = content
    }
  } finally {
    sending.value = false
  }
}

function scrollToLatest() {
  nextTick(() => {
    if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  })
}

watch(messages, scrollToLatest)
onMounted(loadSessions)
</script>

<template>
  <div class="chat-page">
    <div class="page-intro chat-intro"><div><span class="eyebrow">YOUR AI LEGAL ASSISTANT</span><h1>AI 法律助手</h1><p>用自然语言描述问题，和知法一起厘清法律思路。</p></div><span class="ai-status">中国法律法规参考</span></div>
    <div class="chat-layout">
      <aside class="chat-sidebar panel">
        <button class="button button-primary new-chat-button" @click="createSession()"><span>＋</span> 开始新对话</button>
        <div class="session-label">最近对话 <span>{{ sessions.length }}</span></div>
        <div v-if="loading && !sessions.length" class="session-placeholder">正在加载对话…</div>
        <button v-for="session in sessions" :key="session.id" class="session-item" :class="{ selected: selectedSession?.id === session.id }" @click="openSession(session)">
          <span class="session-symbol">◌</span><span class="session-text"><strong>{{ session.title || '新会话' }}</strong><small>{{ session.updateTime ? new Date(session.updateTime).toLocaleDateString('zh-CN') : '刚刚' }}</small></span><span class="session-delete" role="button" aria-label="删除会话" @click="removeSession(session, $event)">×</span>
        </button>
        <div v-if="!sessions.length && !loading" class="session-placeholder">还没有对话记录</div>
        <div class="chat-sidebar-tip"><strong>温馨提示</strong><p>AI 提供的信息仅供参考，不构成正式法律意见。</p></div>
      </aside>

      <section class="conversation panel">
        <div class="conversation-head"><div class="assistant-avatar">知</div><div><strong>{{ selectedSession?.title || '知法法律助手' }}</strong><small>基于中国法律法规为你提供信息参考</small></div><span class="conversation-menu">···</span></div>
        <div ref="messageList" class="message-list">
          <div v-if="!messages.length" class="welcome-chat">
            <div class="welcome-chat-icon">知</div><span class="eyebrow">HELLO, THERE</span><h2>你好，我是知法。</h2><p>告诉我你遇到的法律问题，我会尽力为你梳理相关信息与可能的解决思路。</p>
            <div class="suggestion-list"><button v-for="item in suggestions" :key="item" @click="sendMessage(item)">{{ item }} <span>↗</span></button></div>
          </div>
          <div v-for="message in messages" :key="message.id" class="message-row" :class="message.role === 'user' ? 'from-user' : 'from-assistant'">
            <div v-if="message.role !== 'user'" class="message-avatar">知</div>
            <div class="message-bubble"><small>{{ message.role === 'user' ? '你' : '知法 AI' }}</small><p>{{ message.content }}</p></div>
            <div v-if="message.role === 'user'" class="message-avatar user-message-avatar">U</div>
          </div>
          <div v-if="sending" class="message-row from-assistant"><div class="message-avatar">知</div><div class="message-bubble"><small>知法 AI</small><p class="typing-dots"><i></i><i></i><i></i></p></div></div>
        </div>
        <div class="composer-wrap">
          <p v-if="error" class="inline-error composer-error">{{ error }}</p>
          <form class="composer" @submit.prevent="sendMessage()">
            <textarea v-model="draft" rows="1" placeholder="写下你想了解的法律问题…" :disabled="sending" @keydown.enter.exact.prevent="sendMessage()"></textarea>
            <div class="composer-bottom"><span>AI 生成内容仅供参考，请结合实际情况判断</span><button class="send-button" type="submit" :disabled="!draft.trim() || sending" aria-label="发送消息">↑</button></div>
          </form>
        </div>
      </section>
    </div>
  </div>
</template>
