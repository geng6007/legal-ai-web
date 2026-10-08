<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getErrorMessage, legalApi } from '@/api/legal'

const counts = ref({ chats: '—', reviews: '—', documents: '—', knowledge: '—' })
const recentItems = ref([])
const loadError = ref('')

const shortcuts = [
  { code: '01', title: 'AI 法律助手', description: '描述你的问题，获取清晰的法律解答。', path: '/chat', tag: '智能问答', tone: 'lavender' },
  { code: '02', title: '合同审查', description: '识别合同风险条款，快速获取修改建议。', path: '/contract', tag: '风险识别', tone: 'peach' },
  { code: '03', title: '法律咨询', description: '通过几个简单问题，梳理你的案件情况。', path: '/consult', tag: '咨询向导', tone: 'mint' },
  { code: '04', title: '文书生成', description: '从常用法律文书开始，生成内容草稿。', path: '/documents', tag: '效率工具', tone: 'blue' },
]

onMounted(async () => {
  const results = await Promise.allSettled([
    legalApi.listChatSessions(),
    legalApi.listContractReviews(),
    legalApi.listDocuments(),
    legalApi.listKnowledgeDocuments(),
  ])
  const [chats, reviews, documents, knowledge] = results
  counts.value = {
    chats: chats.status === 'fulfilled' ? chats.value?.length ?? 0 : '—',
    reviews: reviews.status === 'fulfilled' ? reviews.value?.length ?? 0 : '—',
    documents: documents.status === 'fulfilled' ? documents.value?.length ?? 0 : '—',
    knowledge: knowledge.status === 'fulfilled' ? knowledge.value?.length ?? 0 : '—',
  }
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length === results.length) loadError.value = getErrorMessage(failures[0].reason)

  recentItems.value = [
    ...(reviews.status === 'fulfilled'
      ? reviews.value.map((item) => ({ title: item.fileName, type: '合同审查', time: item.createTime, status: item.status, path: '/contract' }))
      : []),
    ...(documents.status === 'fulfilled'
      ? documents.value.map((item) => ({ title: item.title, type: '文书生成', time: item.createTime, status: 'DONE', path: '/documents' }))
      : []),
  ]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 4)
})
</script>

<template>
  <div class="dashboard-page">
    <section class="welcome-banner">
      <div class="welcome-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span> LEGAL AI WORKSPACE</span>
        <h1>让每一个法律问题，<br>都有清晰的下一步。</h1>
        <p>你好，欢迎来到知法。把复杂的法律事务，交给更聪明的工作方式。</p>
        <RouterLink class="button button-light" to="/chat">开始法律咨询 <span>→</span></RouterLink>
      </div>
      <div class="banner-art" aria-hidden="true">
        <div class="art-orbit orbit-one"></div>
        <div class="art-orbit orbit-two"></div>
        <div class="art-seal"><span>知</span><small>LEGAL AI</small></div>
        <div class="art-caption">CLARITY<br>IN EVERY CASE</div>
        <div class="art-spark spark-one">✳</div>
        <div class="art-spark spark-two">✦</div>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card"><span class="stat-icon stat-purple">问</span><span class="stat-label">法律对话</span><strong>{{ counts.chats }}</strong><small>个咨询会话</small></article>
      <article class="stat-card"><span class="stat-icon stat-orange">审</span><span class="stat-label">合同审查</span><strong>{{ counts.reviews }}</strong><small>份合同已分析</small></article>
      <article class="stat-card"><span class="stat-icon stat-green">文</span><span class="stat-label">生成文书</span><strong>{{ counts.documents }}</strong><small>份文书草稿</small></article>
      <article class="stat-card"><span class="stat-icon stat-blue">知</span><span class="stat-label">知识文档</span><strong>{{ counts.knowledge }}</strong><small>篇参考资料</small></article>
    </section>

    <section class="section-heading">
      <div><span class="eyebrow">YOUR LEGAL TOOLKIT</span><h2>智能法律工具</h2><p>从问题梳理到文书草拟，让每一步都更简单。</p></div>
      <RouterLink class="text-link" to="/knowledge">浏览知识库 <span>→</span></RouterLink>
    </section>

    <section class="tool-grid">
      <RouterLink v-for="tool in shortcuts" :key="tool.path" :to="tool.path" class="tool-card" :class="tool.tone">
        <div class="tool-card-top"><span class="tool-number">{{ tool.code }}</span><span class="tool-arrow">↗</span></div>
        <span class="tool-tag">{{ tool.tag }}</span>
        <h3>{{ tool.title }}</h3>
        <p>{{ tool.description }}</p>
      </RouterLink>
    </section>

    <section class="lower-grid">
      <div class="panel recent-panel">
        <div class="panel-heading"><div><span class="eyebrow">RECENT ACTIVITY</span><h2>最近使用</h2></div><span class="panel-count">{{ recentItems.length }} 条记录</span></div>
        <p v-if="loadError" class="inline-error">{{ loadError }}。请检查后端服务是否已启动。</p>
        <div v-else-if="recentItems.length" class="activity-list">
          <RouterLink v-for="(item, index) in recentItems" :key="`${item.type}-${index}`" :to="item.path" class="activity-row">
            <span class="activity-icon">{{ item.type === '合同审查' ? '审' : '文' }}</span>
            <span class="activity-info"><strong>{{ item.title || '未命名' }}</strong><small>{{ item.type }} · {{ item.time ? new Date(item.time).toLocaleDateString('zh-CN') : '刚刚' }}</small></span>
            <span class="status-pill" :class="item.status === 'FAILED' ? 'status-failed' : 'status-done'">{{ item.status === 'FAILED' ? '失败' : item.status === 'ANALYZING' ? '处理中' : '已完成' }}</span>
          </RouterLink>
        </div>
        <div v-else class="empty-state compact-empty"><span>✳</span><strong>你的工作记录会显示在这里</strong><small>开始使用智能工具，轻松处理法律事务。</small></div>
      </div>
      <div class="note-card">
        <span class="eyebrow">A NOTE FROM ZHIFA</span>
        <div class="note-mark">“</div>
        <h3>法律知识可以很专业，<br>也可以很亲近。</h3>
        <p>知法为你提供信息整理与内容草拟支持。遇到重要法律事项，请结合具体情况咨询专业律师。</p>
        <span class="note-signature">知法 · 你的法律 AI 助手</span>
      </div>
    </section>
  </div>
</template>
