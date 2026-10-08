import { createRouter, createWebHistory } from 'vue-router'

import ChatView from '@/views/ChatView.vue'
import ConsultView from '@/views/ConsultView.vue'
import ContractView from '@/views/ContractView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DocumentsView from '@/views/DocumentsView.vue'
import KnowledgeView from '@/views/KnowledgeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/chat', component: ChatView },
    { path: '/consult', component: ConsultView },
    { path: '/contract', component: ContractView },
    { path: '/documents', component: DocumentsView },
    { path: '/knowledge', component: KnowledgeView },
  ],
})

export default router
