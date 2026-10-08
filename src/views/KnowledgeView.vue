<script setup>
import { computed, onMounted, ref } from 'vue'
import { getErrorMessage, legalApi } from '@/api/legal'

const documents = ref([])
const activeType = ref('')
const query = ref('')
const searchResults = ref(null)
const searchQuery = ref('')
const showAddForm = ref(false)
const form = ref({ title: '', source: '', docType: 'law', content: '' })
const pdfFile = ref(null)
const uploadMode = ref('text')
const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const error = ref('')
const filteredDocuments = computed(() => documents.value)

const types = [
  { value: '', label: '全部资料' },
  { value: 'law', label: '法律法规' },
  { value: 'case', label: '案例参考' },
  { value: 'contract', label: '合同范本' },
]

async function loadDocuments() {
  loading.value = true
  error.value = ''
  try {
    documents.value = (await legalApi.listKnowledgeDocuments(activeType.value)) || []
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    loading.value = false
  }
}

async function search() {
  if (!query.value.trim() || searching.value) return
  searching.value = true
  error.value = ''
  searchQuery.value = query.value.trim()
  try {
    searchResults.value = (await legalApi.searchKnowledge(searchQuery.value, 5)) || []
  } catch (reason) {
    searchResults.value = null
    error.value = getErrorMessage(reason)
  } finally {
    searching.value = false
  }
}

async function addDocument() {
  if (!form.value.title.trim() || !form.value.content.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await legalApi.addKnowledgeDocument({
      title: form.value.title.trim(),
      source: form.value.source.trim(),
      docType: form.value.docType,
      content: form.value.content.trim(),
    })
    showAddForm.value = false
    form.value = { title: '', source: '', docType: 'law', content: '' }
    searchResults.value = null
    await loadDocuments()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    saving.value = false
  }
}

function selectPdf(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type && file.type !== 'application/pdf') {
    error.value = '请选择有效的 PDF 文件。'
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    error.value = 'PDF 文件不能超过 20 MB。'
    return
  }
  pdfFile.value = file
  if (!form.value.title.trim()) {
    form.value.title = file.name.replace(/\.pdf$/i, '')
  }
  error.value = ''
}

async function uploadPdf() {
  if (!pdfFile.value || !form.value.title.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await legalApi.uploadKnowledgePdf({
      file: pdfFile.value,
      title: form.value.title.trim(),
      source: form.value.source.trim(),
      docType: form.value.docType,
    })
    showAddForm.value = false
    pdfFile.value = null
    form.value = { title: '', source: '', docType: 'law', content: '' }
    searchResults.value = null
    await loadDocuments()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    saving.value = false
  }
}

async function deleteDocument(document) {
  if (!window.confirm(`确定从知识库删除“${document.title}”吗？`)) return
  error.value = ''
  try {
    await legalApi.deleteKnowledgeDocument(document.id)
    await loadDocuments()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  }
}

function clearSearch() {
  searchResults.value = null
  searchQuery.value = ''
  query.value = ''
}

onMounted(loadDocuments)
</script>

<template>
  <div class="tool-page knowledge-page">
    <div class="page-intro"><div><span class="eyebrow">LEGAL KNOWLEDGE BASE</span><h1>法律知识库</h1><p>管理法律参考资料，基于知识库内容进行语义检索。</p></div><button class="button button-primary" @click="showAddForm = !showAddForm"><span>＋</span> 添加资料</button></div>

    <section class="knowledge-search panel">
      <div><span class="eyebrow">SEMANTIC SEARCH</span><h2>你想查找什么？</h2><p>输入法律问题或关键词，检索相关知识片段。</p></div>
      <form class="knowledge-search-form" @submit.prevent="search"><span class="search-icon">⌕</span><input v-model="query" placeholder="例如：劳动合同解除的经济补偿规定" :disabled="searching"><button class="button button-primary" :disabled="searching || !query.trim()">{{ searching ? '搜索中…' : '搜索' }}</button></form>
    </section>

    <section v-if="showAddForm" class="panel add-document-panel">
      <div class="panel-heading"><div><span class="eyebrow">ADD TO LIBRARY</span><h2>添加知识文档</h2></div><button class="close-button" aria-label="关闭" @click="showAddForm = false">×</button></div>
      <div class="upload-mode-tabs">
        <button :class="{ active: uploadMode === 'text' }" @click="uploadMode = 'text'">粘贴文本</button>
        <button :class="{ active: uploadMode === 'pdf' }" @click="uploadMode = 'pdf'">上传 PDF</button>
      </div>
      <div class="add-document-fields">
        <label class="form-field"><span>文档标题 <i>必填</i></span><input v-model="form.title" class="text-input" placeholder="例如：中华人民共和国民法典"></label>
        <label class="form-field"><span>资料来源</span><input v-model="form.source" class="text-input" placeholder="填写来源或链接（选填）"></label>
        <label class="form-field"><span>文档类型</span><select v-model="form.docType" class="text-input"><option value="law">法律法规</option><option value="case">案例参考</option><option value="contract">合同范本</option></select></label>
        <label v-if="uploadMode === 'text'" class="form-field full-field"><span>文档内容 <i>必填</i></span><textarea v-model="form.content" class="details-textarea" placeholder="粘贴文档正文。添加后系统会切分内容并建立语义检索索引。"></textarea></label>
        <div v-else class="form-field full-field"><span>PDF 文件 <i>必填</i></span><label class="pdf-upload-zone"><input type="file" accept="application/pdf,.pdf" @change="selectPdf"><span class="pdf-upload-icon">↑</span><strong>{{ pdfFile?.name || '点击选择 PDF 文件' }}</strong><small>{{ pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : '上传后将自动提取文本并建立检索索引，最大 20 MB' }}</small></label></div>
      </div>
      <div class="form-footer"><span>{{ uploadMode === 'pdf' ? '仅支持含可复制文本的 PDF，扫描件暂不支持 OCR。' : '支持纯文本内容，提交后将建立语义检索索引。' }}</span><button class="button button-primary" :disabled="saving || !form.title.trim() || (uploadMode === 'pdf' ? !pdfFile : !form.content.trim())" @click="uploadMode === 'pdf' ? uploadPdf() : addDocument()">{{ saving ? uploadMode === 'pdf' ? '解析并添加中…' : '添加中…' : uploadMode === 'pdf' ? '上传并添加' : '添加到知识库' }} <span>→</span></button></div>
    </section>

    <p v-if="error" class="inline-error knowledge-error">{{ error }}</p>

    <section v-if="searchResults !== null" class="search-results-section">
      <div class="section-heading"><div><span class="eyebrow">SEARCH RESULTS</span><h2>“{{ searchQuery }}” 的检索结果</h2><p>以下内容来自知识库语义检索。</p></div><button class="text-link-button" @click="clearSearch">清除搜索 ×</button></div>
      <div v-if="searchResults.length" class="search-result-list"><article v-for="(result, index) in searchResults" :key="index" class="panel search-result-card"><span class="result-index">0{{ index + 1 }}</span><p>{{ result }}</p><span class="result-source">知识库匹配片段</span></article></div>
      <div v-else class="panel table-empty">没有检索到相关内容，可以尝试更换关键词。</div>
    </section>

    <section class="knowledge-library">
      <div class="section-heading"><div><span class="eyebrow">YOUR LIBRARY</span><h2>知识文档</h2><p>已收录 {{ filteredDocuments.length }} 篇资料</p></div><div class="filter-tabs"><button v-for="type in types" :key="type.value" :class="{ active: activeType === type.value }" @click="activeType = type.value; loadDocuments()">{{ type.label }}</button></div></div>
      <div v-if="documents.length" class="knowledge-grid">
        <article v-for="document in documents" :key="document.id" class="panel knowledge-card">
          <div class="knowledge-card-top"><span class="knowledge-type" :class="`type-${document.docType || 'law'}`">{{ document.docType === 'case' ? '案例' : document.docType === 'contract' ? '合同' : '法规' }}</span><button class="row-menu" :aria-label="`删除${document.title}`" @click="deleteDocument(document)">···</button></div>
          <h3>{{ document.title }}</h3><p class="knowledge-source">{{ document.source || '未注明来源' }}</p><div class="knowledge-card-footer"><span>{{ document.chunkCount || 0 }} 个内容片段</span><span>{{ document.createTime ? new Date(document.createTime).toLocaleDateString('zh-CN') : '—' }}</span></div>
        </article>
      </div>
      <div v-else class="panel library-empty empty-state"><span class="empty-illustration">知</span><strong>{{ loading ? '正在读取知识库…' : '知识库还是空的' }}</strong><small>添加法律法规、案例或合同范本，开始构建你的参考资料库。</small><button class="button button-outline" @click="showAddForm = true">添加第一篇资料</button></div>
    </section>
  </div>
</template>
