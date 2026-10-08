<script setup>
import { onMounted, ref } from 'vue'
import { getErrorMessage, legalApi, streamDocumentGeneration } from '@/api/legal'

const templates = [
  { code: 'lawyer_letter', name: '律师函', description: '用于正式沟通与权利主张' },
  { code: 'labor_contract', name: '劳动合同', description: '劳动关系约定参考草稿' },
  { code: 'rental_contract', name: '房屋租赁合同', description: '房屋租赁事项约定草稿' },
  { code: 'civil_complaint', name: '民事起诉状', description: '民事纠纷起诉材料草稿' },
  { code: 'custom', name: '其他法律文书', description: '根据你的说明生成文书草稿' },
]

const documents = ref([])
const selectedTemplate = ref(templates[0])
const title = ref('关于维护合法权益的律师函')
const details = ref('')
const generated = ref(null)
const loading = ref(false)
const generating = ref(false)
const error = ref('')
const copied = ref(false)

async function loadDocuments() {
  loading.value = true
  try {
    documents.value = (await legalApi.listDocuments()) || []
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!title.value.trim() || !details.value.trim() || generating.value) return
  generating.value = true
  error.value = ''
  generated.value = null
  try {
    const request = {
      templateCode: selectedTemplate.value.code,
      title: title.value.trim(),
      params: details.value.trim(),
    }
    generated.value = { title: request.title, content: '' }
    await streamDocumentGeneration(request, {
      onToken: (token) => { generated.value.content += token },
      onDone: (document) => { generated.value = document },
    })
    await loadDocuments()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    generating.value = false
  }
}

async function copyContent() {
  if (!generated.value?.content) return
  try {
    await navigator.clipboard.writeText(generated.value.content)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1800)
  } catch {
    error.value = '复制失败，请手动选择并复制文书内容。'
  }
}

function selectDocument(document) {
  generated.value = document
}

onMounted(loadDocuments)
</script>

<template>
  <div class="tool-page">
    <div class="page-intro"><div><span class="eyebrow">LEGAL DOCUMENT STUDIO</span><h1>文书生成</h1><p>选择文书类型，补充必要信息，生成一份可继续修改的内容草稿。</p></div><span class="intro-badge">AI 文书草拟</span></div>

    <div class="document-workspace">
      <section class="panel document-form-panel">
        <div class="panel-heading"><div><span class="eyebrow">DOCUMENT BUILDER</span><h2>创建文书草稿</h2></div><span class="step-number">01</span></div>
        <label class="field-label">选择文书类型</label>
        <div class="template-list">
          <button v-for="template in templates" :key="template.code" class="template-option" :class="{ chosen: selectedTemplate.code === template.code }" @click="selectedTemplate = template">
            <span class="template-mark">{{ template.name.slice(0, 1) }}</span><span class="template-copy"><strong>{{ template.name }}</strong><small>{{ template.description }}</small></span><span class="template-radio"></span>
          </button>
        </div>
        <label class="field-label title-field-label" for="document-title">文书标题 <span>必填</span></label>
        <input id="document-title" v-model="title" class="text-input" placeholder="输入文书标题">
        <label class="field-label" for="document-details">案件与当事人信息 <span>必填</span></label>
        <textarea id="document-details" v-model="details" class="details-textarea" placeholder="请填写当事人、事实经过、诉求或其他相关信息。&#10;&#10;信息越清晰，生成的草稿越贴合你的需求。"></textarea>
        <p v-if="error" class="inline-error">{{ error }}</p>
        <button class="button button-primary full-button" :disabled="generating || !title.trim() || !details.trim()" @click="generate">{{ generating ? '正在生成文书…' : '生成文书草稿' }} <span>→</span></button>
      </section>

      <section class="panel generated-panel">
        <div class="panel-heading"><div><span class="eyebrow">DRAFT PREVIEW</span><h2>{{ generated?.title || '文书预览' }}</h2></div><button v-if="generated?.content" class="button button-outline copy-button" @click="copyContent">{{ copied ? '已复制 ✓' : '复制全文' }}</button></div>
        <div v-if="generated?.content" class="generated-content">{{ generated.content }}<span v-if="generating" class="stream-cursor" aria-label="正在生成"></span></div>
        <div v-else-if="generating" class="generation-loading"><span class="loading-spinner"></span><strong>正在为你准备文书草稿</strong><small>AI 正在整理信息，请稍候…</small></div>
        <div v-else class="empty-state preview-empty"><span class="empty-illustration">文</span><strong>你的文书草稿将在这里呈现</strong><small>先选择文书类型，再填写案件信息开始生成。</small></div>
        <div class="disclaimer">生成内容为草稿，请核实事实并根据实际情况修改后再使用。</div>
      </section>
    </div>

    <section class="panel document-history">
      <div class="panel-heading"><div><span class="eyebrow">DOCUMENT LIBRARY</span><h2>生成记录</h2></div><button class="text-link-button" :disabled="loading" @click="loadDocuments">↻ 刷新</button></div>
      <div v-if="documents.length" class="document-records">
        <button v-for="document in documents" :key="document.id" class="document-record" :class="{ 'active-record': generated?.id === document.id }" @click="selectDocument(document)">
          <span class="record-icon">文</span><span class="record-copy"><strong>{{ document.title }}</strong><small>{{ document.templateCode }} · {{ document.createTime ? new Date(document.createTime).toLocaleString('zh-CN') : '—' }}</small></span><span class="record-open">查看 →</span>
        </button>
      </div>
      <div v-else class="table-empty">{{ loading ? '正在读取记录…' : '还没有文书记录，生成的草稿会保存在这里。' }}</div>
    </section>
  </div>
</template>
