<script setup>
import { computed, ref } from 'vue'
import { getErrorMessage, legalApi, streamConsultReport } from '@/api/legal'

const scenarios = [
  { code: 'labor_dispute', title: '劳动争议', description: '工资、辞退、劳动合同等职场问题', mark: '职' },
  { code: 'rental_dispute', title: '租房纠纷', description: '押金、维修、提前解约等租赁问题', mark: '居' },
  { code: 'traffic_accident', title: '交通事故', description: '责任认定、赔偿协商与处理流程', mark: '行' },
]
const questions = {
  labor_dispute: ['请简单描述发生了什么？', '你与单位是否签订了劳动合同？工作了多长时间？', '你目前有哪些相关证据或材料？', '你希望通过咨询优先解决什么问题？'],
  rental_dispute: ['请介绍一下租赁关系和目前遇到的问题。', '你是否签订了书面租赁合同，合同中如何约定？', '你与房东沟通过吗？目前有哪些记录或证据？', '你希望优先达成什么结果？'],
  traffic_accident: ['请描述事故发生的时间、地点和经过。', '交警是否出具了事故责任认定书？', '目前产生了哪些损失或医疗费用？', '你希望优先了解哪方面的处理方式？'],
}
const selectedScenario = ref(null)
const session = ref(null)
const step = ref(0)
const answer = ref('')
const answers = ref([])
const report = ref('')
const generatingReport = ref(false)
const busy = ref(false)
const error = ref('')
const currentQuestion = computed(() => (selectedScenario.value ? questions[selectedScenario.value.code][step.value] : ''))
const progress = computed(() => session.value ? Math.min((step.value / questions[selectedScenario.value.code].length) * 100, 100) : 0)

async function beginScenario(scenario) {
  busy.value = true
  error.value = ''
  try {
    selectedScenario.value = scenario
    session.value = await legalApi.createConsultSession(scenario.code)
    step.value = 0
    answers.value = []
    answer.value = ''
    report.value = ''
  } catch (reason) {
    selectedScenario.value = null
    error.value = getErrorMessage(reason)
  } finally {
    busy.value = false
  }
}

async function submitAnswer() {
  if (!answer.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await legalApi.submitConsultAnswer(session.value.id, step.value + 1, answer.value.trim())
    answers.value.push(answer.value.trim())
    answer.value = ''
    step.value += 1
    if (step.value === questions[selectedScenario.value.code].length) await completeSession()
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    busy.value = false
  }
}

async function completeSession() {
  if (generatingReport.value) return
  generatingReport.value = true
  report.value = ''
  error.value = ''
  try {
    await streamConsultReport(session.value.id, {
      onToken: (token) => { report.value += token },
      onDone: (completed) => {
        session.value = completed
        report.value = completed.report || report.value
      },
    })
  } catch (reason) {
    error.value = getErrorMessage(reason)
  } finally {
    generatingReport.value = false
  }
}

function resetConsult() {
  selectedScenario.value = null
  session.value = null
  step.value = 0
  answers.value = []
  report.value = ''
  error.value = ''
}
</script>

<template>
  <div class="tool-page consult-page">
    <div class="page-intro"><div><span class="eyebrow">GUIDED LEGAL CONSULTATION</span><h1>法律咨询</h1><p>先从具体场景出发，通过几个问题整理事实与关注点。</p></div><span class="intro-badge">结构化咨询</span></div>

    <section v-if="report || generatingReport" class="panel report-panel">
      <div class="report-header"><div class="report-icon">知</div><div><span class="eyebrow">YOUR CONSULTATION REPORT</span><h2>咨询梳理报告</h2><p>{{ selectedScenario.title }} · {{ generatingReport ? '生成中' : session?.status === 'COMPLETED' ? '已完成' : '待重试' }}</p></div><button v-if="!generatingReport && session?.status !== 'COMPLETED'" class="button button-outline" @click="completeSession">重试生成</button><button class="button button-outline" @click="resetConsult">新建咨询</button></div>
      <div class="report-notice">{{ generatingReport ? 'AI 正在生成报告，内容会实时显示。' : '以下内容由 AI 根据你提供的信息生成，仅供参考。复杂或紧急事项，建议咨询执业律师。' }}</div>
      <p v-if="error" class="inline-error">{{ error }}</p>
      <article class="report-content">{{ report }}<span v-if="generatingReport" class="stream-cursor" aria-label="正在生成"></span></article>
      <div class="answered-summary"><strong>本次梳理了 {{ answers.length }} 项信息</strong><div v-for="(item, index) in answers" :key="index"><span>0{{ index + 1 }}</span>{{ item }}</div></div>
    </section>

    <template v-else>
      <section v-if="!selectedScenario" class="scenario-section">
        <div class="section-heading"><div><span class="eyebrow">CHOOSE A SCENARIO</span><h2>你想咨询哪方面？</h2><p>选择最接近你情况的主题，我们会一步步帮你梳理。</p></div></div>
        <div class="scenario-grid">
          <button v-for="scenario in scenarios" :key="scenario.code" class="scenario-card" :disabled="busy" @click="beginScenario(scenario)">
            <span class="scenario-mark">{{ scenario.mark }}</span><span class="scenario-arrow">↗</span><h3>{{ scenario.title }}</h3><p>{{ scenario.description }}</p><span class="scenario-link">开始梳理 <b>→</b></span>
          </button>
        </div>
      </section>

      <section v-else class="panel questionnaire-panel">
        <div class="questionnaire-top"><button class="back-button" @click="resetConsult">← 返回场景</button><span class="question-counter">问题 {{ Math.min(step + 1, questions[selectedScenario.code].length) }} <i>/</i> {{ questions[selectedScenario.code].length }}</span></div>
        <div class="progress-track"><span :style="{ width: `${progress}%` }"></span></div>
        <div class="question-body">
          <template v-if="step < questions[selectedScenario.code].length">
            <span class="eyebrow">{{ selectedScenario.title }} · 信息梳理</span>
            <h2>{{ currentQuestion }}</h2>
            <p>请尽量按实际情况描述，不确定的部分也可以直接说明。</p>
            <textarea v-model="answer" rows="5" :placeholder="step === 0 ? '例如：事情发生的时间、经过，以及你已经做过的处理…' : '在这里输入你的回答…'" @keydown.ctrl.enter="submitAnswer"></textarea>
            <p v-if="error" class="inline-error">{{ error }}</p>
            <div class="question-actions"><span>你的回答仅用于生成本次咨询梳理</span><button class="button button-primary" :disabled="!answer.trim() || busy" @click="submitAnswer">{{ busy ? '正在处理…' : step + 1 === questions[selectedScenario.code].length ? '生成咨询报告' : '继续' }} <span>→</span></button></div>
          </template>
          <template v-else>
            <span class="eyebrow">{{ selectedScenario.title }} · 信息梳理</span>
            <h2>你的信息已整理完成</h2>
            <p>生成报告时遇到问题，可以重试；已提交的回答会保留。</p>
            <p v-if="error" class="inline-error">{{ error }}</p>
            <div class="question-actions"><span>已收集 {{ answers.length }} 项信息</span><button class="button button-primary" :disabled="busy || generatingReport" @click="completeSession">{{ generatingReport ? '正在流式生成…' : '重试生成报告' }} <span>→</span></button></div>
          </template>
        </div>
      </section>
    </template>

    <div v-if="error && !selectedScenario" class="inline-error scenario-error">{{ error }}</div>
    <div class="consult-footnote"><span>i</span><p>知法 AI 提供的信息仅供一般参考，不构成针对个案的正式法律意见，也不替代律师服务。</p></div>
  </div>
</template>
