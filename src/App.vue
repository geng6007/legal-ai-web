<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navigation = [
  { label: '工作台', path: '/', section: '总览' },
  { label: 'AI 法律助手', path: '/chat', section: '智能工具' },
  { label: '法律咨询', path: '/consult', section: '智能工具' },
  { label: '合同审查', path: '/contract', section: '智能工具' },
  { label: '文书生成', path: '/documents', section: '智能工具' },
  { label: '法律知识库', path: '/knowledge', section: '资源中心' },
]

const pageTitle = computed(
  () => navigation.find((item) => item.path === route.path)?.label ?? '工作台',
)
const groups = computed(() => [
  { title: '总览', links: navigation.filter((item) => item.section === '总览') },
  { title: '智能工具', links: navigation.filter((item) => item.section === '智能工具') },
  { title: '资源中心', links: navigation.filter((item) => item.section === '资源中心') },
])
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">法</span>
        <span class="brand-copy">
          <strong>知法</strong>
          <small>LEGAL AI WORKSPACE</small>
        </span>
      </RouterLink>

      <div class="workspace-switch">
        <span class="workspace-avatar">知</span>
        <span><strong>个人工作空间</strong><small>法律智能平台</small></span>
        <span class="switch-caret">⌄</span>
      </div>

      <nav class="side-nav" aria-label="主导航">
        <section v-for="group in groups" :key="group.title" class="nav-group">
          <p class="nav-heading">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.links"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ active: route.path === item.path }"
          >
            <span class="nav-indicator"></span>
            <span>{{ item.label }}</span>
            <span v-if="item.path === '/chat'" class="nav-new">AI</span>
          </RouterLink>
        </section>
      </nav>

      <div class="sidebar-bottom">
        <div class="help-card">
          <span class="help-spark">✳</span>
          <strong>让法律服务更简单</strong>
          <p>由 AI 助力，快速找到清晰、可靠的下一步。</p>
          <RouterLink to="/chat">开始咨询 <span>→</span></RouterLink>
        </div>
        <div class="profile">
          <div class="profile-avatar">U</div>
          <div class="profile-copy"><strong>我的工作台</strong><small>免费体验版</small></div>
          <button class="more-button" aria-label="更多选项">···</button>
        </div>
      </div>
    </aside>

    <div class="main-column">
      <header class="topbar">
        <div class="breadcrumbs"><span>知法</span><span class="breadcrumb-slash">/</span><strong>{{ pageTitle }}</strong></div>
        <div class="topbar-actions">
          <span class="service-status">LEGAL AI WORKSPACE</span>
          <button class="icon-button" aria-label="帮助">?</button>
          <button class="icon-button notification-button" aria-label="通知">♧<i></i></button>
          <div class="top-avatar">U</div>
        </div>
      </header>
      <main class="page-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
