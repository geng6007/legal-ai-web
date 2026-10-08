<script setup>
import { computed, onMounted, ref } from 'vue'
import { getErrorMessage, legalApi, streamContractReview } from '@/api/legal'

const contractText = ref('')
const fileName = ref('')
const reviews = ref([])
const selectedReview = ref(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const parsedResult = computed(() => {
  if (!selectedReview.value?.result) return null
  try {
    const cleaned = selectedReview.value.result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
})

async function loadReviews() {
  loading.value = true
  try {
    reviews.value = (await legalApi.listContractReviews()) || []
    if (selectedReview.value) {
      selectedReview.value = reviews.value.find((item) => item.id === selectedReview.value.id) || selectedReview.value
    }
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function handleFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!/\.(txt|md|text)$/i.test(file.name)) {
    error.value = '目前仅支持读取 TXT 或 Markdown 文本文件，请将合同内容粘贴到输入框。'
    event.target.value = ''
    return
  }
  try {
    contractText.value = await file.text()
    fileName.value = file.name
    error.value = ''
  } catch (reason) {
    error.value = `无法读取文件：${getErrorMessage(reason)}`
  }
  event.target.value = ''
}

async function submitReview() {
  if (!contractText.value.trim() || submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const request = {
      fileName: fileName.value || '粘贴的合同内容',
      content: contractText.value,
    }
    selectedReview.value = {
      fileName: request.fileName,
      status: 'ANALYZING',
      clauseCount: null,
      riskCount: null,
      result: '',
    }
    await streamContractReview(request, {
      onStart: (task) => { selectedReview.value = task },
      onToken: (token) => {
        selectedReview.value.result += token
      },
      onDone: (task) => { selectedReview.value = task },
    })
    await loadReviews()
  } catch (reason) {
    error.value = getErrorMessage(reason)
    if (selectedReview.value?.id) {
      try {
        selectedReview.value = await legalApi.getContractReview(selectedReview.value.id)
        await loadReviews()
      } catch (refreshError) {
        error.value = `${error.value}；刷新审查状态失败：${getErrorMessage(refreshError)}`
      }
    }
  } finally {
    submitting.value = false
  }
}

function selectReview(review) {
  selectedReview.value = review
  if (review.id) {
    legalApi.getContractReview(review.id).then((item) => { selectedReview.value = item }).catch((reason) => { error.value = getErrorMessage(reason) })
  }
}

onMounted(loadReviews)
</script>

<template>
  <div class="tool-page">
    <div class="page-intro"><div><span class="eyebrow">CONTRACT REVIEW</span><h1>合同审查</h1><p>识别潜在风险条款，获取更易理解的分析与修改建议。</p></div><span class="intro-badge">AI 风险分析</span></div>

    <div class="contract-grid">
      <section class="panel contract-input-panel">
        <div class="panel-heading"><div><span class="eyebrow">NEW REVIEW</span><h2>开始合同审查</h2></div><span class="step-number">01</span></div>
        <label class="field-label">合同内容 <span>必填</span></label>
        <div class="upload-hint"><span class="upload-icon">↑</span><span><strong>粘贴合同文本，或选择文本文件</strong><small>支持 .txt、.md 文件，单次提交一份合同</small></span><label class="button button-outline upload-button">选择文件<input type="file" accept=".txt,.md,.text" @change="handleFile"></label></div>
        <textarea v-model="contractText" class="contract-textarea" placeholder="将合同正文粘贴到这里…&#10;&#10;为获得更准确的分析，请尽量提供完整的合同内容。" />
        <p v-if="fileName" class="selected-file">已载入：{{ fileName }} <button @click="fileName = ''">移除</button></p>
        <p v-if="error" class="inline-error">{{ error }}</p>
        <div class="contract-actions"><span>提交即表示你已确认有权提供该合同内容。</span><button class="button button-primary" :disabled="!contractText.trim() || submitting" @click="submitReview">{{ submitting ? '分析中…' : '开始 AI 审查' }} <span>→</span></button></div>
      </section>

      <section class="panel review-result-panel">
        <div class="panel-heading"><div><span class="eyebrow">REVIEW RESULT</span><h2>{{ selectedReview ? '审查结果' : '你的分析报告' }}</h2></div><span v-if="selectedReview?.status" class="status-pill" :class="selectedReview.status === 'FAILED' ? 'status-failed' : 'status-done'">{{ selectedReview.status === 'DONE' ? '已完成' : selectedReview.status === 'FAILED' ? '失败' : '流式分析中' }}</span></div>
        <template v-if="selectedReview">
          <div class="result-summary">
            <div class="risk-score"><strong>{{ selectedReview.riskCount ?? '—' }}</strong><span>项风险条款</span></div>
            <div class="summary-divider"></div>
            <div class="risk-score muted-score"><strong>{{ selectedReview.clauseCount ?? '—' }}</strong><span>项合同条款</span></div>
            <p class="review-file-name">{{ selectedReview.fileName }}</p>
          </div>
          <div v-if="parsedResult?.clauses?.length" class="clause-list">
            <article v-for="(clause, index) in parsedResult.clauses" :key="index" class="clause-card">
              <div class="clause-top"><strong>{{ clause.clause_no || `条款 ${index + 1}` }}</strong><span class="risk-label" :class="String(clause.risk_level || '').includes('高') ? 'risk-high' : 'risk-medium'">{{ clause.risk_level || '待评估' }}风险</span></div>
              <p class="clause-content">{{ clause.content }}</p><p class="clause-analysis"><strong>分析</strong>{{ clause.analysis }}</p><p class="clause-suggestion"><strong>修改建议</strong>{{ clause.suggestion }}</p>
            </article>
          </div>
          <pre v-else class="plain-result">{{ selectedReview.result || (selectedReview.status === 'ANALYZING' ? '正在分析合同…' : '暂无审查结果。') }}<span v-if="submitting" class="stream-cursor" aria-label="正在生成"></span></pre>
        </template>
        <div v-else class="empty-state result-empty"><span class="empty-illustration">§</span><strong>审查报告将在这里呈现</strong><small>提交合同后，AI 将为你梳理条款并提示值得关注的风险。</small></div>
        <div class="disclaimer">分析结果由 AI 生成，仅供信息参考，不构成正式法律意见。</div>
      </section>
    </div>

    <section class="panel review-history">
      <div class="panel-heading"><div><span class="eyebrow">YOUR REVIEWS</span><h2>审查记录</h2></div><button class="text-link-button" :disabled="loading" @click="loadReviews">↻ 刷新</button></div>
      <div v-if="reviews.length" class="table-wrap"><table><thead><tr><th>合同名称</th><th>审查时间</th><th>条款数</th><th>风险项</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="review in reviews" :key="review.id" :class="{ 'active-table-row': selectedReview?.id === review.id }"><td><button class="table-title" @click="selectReview(review)">{{ review.fileName }}</button></td><td>{{ review.createTime ? new Date(review.createTime).toLocaleString('zh-CN') : '—' }}</td><td>{{ review.clauseCount ?? '—' }}</td><td>{{ review.riskCount ?? '—' }}</td><td><span class="status-pill" :class="review.status === 'FAILED' ? 'status-failed' : 'status-done'">{{ review.status === 'DONE' ? '已完成' : review.status === 'FAILED' ? '失败' : '处理中' }}</span></td><td><button class="row-action" @click="selectReview(review)">查看 →</button></td></tr></tbody></table></div>
      <div v-else class="table-empty">{{ loading ? '正在读取记录…' : '暂无审查记录，完成第一次分析后会显示在这里。' }}</div>
    </section>
  </div>
</template>
