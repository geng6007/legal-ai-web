# 知法 · 法律 AI 工作台

基于 Vue 3、Vite 和 Vue Router 构建的法律 AI 前端，配套 `legal-ai-backend` Spring Boot 服务。

## 功能页面

- 工作台：会话、合同审查、文书和知识文档概览
- AI 法律助手：多轮对话、会话历史与删除
- 法律咨询：劳动争议、租房纠纷和交通事故结构化咨询
- 合同审查：粘贴或导入 TXT/Markdown 合同，查看风险分析和审查记录
- 文书生成：选择文书类型、填写案件信息并查看生成记录
- 法律知识库：文档管理、分类浏览、语义检索及 PDF 文本提取上传
- AI 对话、咨询报告、合同审查和文书草稿均通过 SSE 流式展示生成内容

## 本地运行

需要 Node.js 22.18+。

```sh
npm install
npm run dev
```

开发服务器会将 `/api` 请求代理到 `http://localhost:8080`。请先启动后端服务，并按后端项目说明配置 MySQL 和 `DASHSCOPE_API_KEY`。

## 生产构建

```sh
npm run build
npm run preview
```
