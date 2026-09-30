## 1. 数据模型与后端基础设施

- [x] 1.1 ExamPaper模型新增 `editedMarkdown String?` 字段，执�?`npx prisma db push` 同步数据库，验证字段存在
- [x] 1.2 修改 `papers.ts` 导入路由：移除自动调�?`splitQuestionsFromPaper`，导入后状态保�?`uploaded`，验证导入返�?`autoSplit: null`
- [x] 1.3 新增 `PUT /api/papers/:id/markdown` 端点：保存editedMarkdown，状态变�?`editing`，验证返�?00+更新后的paper
- [x] 1.4 新增 `POST /api/papers/:id/split-preview` 端点：使用editedMarkdown（或回退parsedMarkdown）调用splitQuestionsFromMarkdown，返回题目数组（不入库），验证返回题目列表JSON
- [x] 1.5 新增 `POST /api/papers/:id/confirm-import` 端点：基于editedMarkdown（或parsedMarkdown）执行splitQuestionsFromPaper入库，状态变�?`completed`，验证Question记录创建

## 2. 前端API服务�?
- [x] 2.1 �?`papers-api.ts` 新增3个API函数：`saveMarkdown(token, paperId, markdown)`、`splitPreview(token, paperId)`、`confirmImport(token, paperId)`，验证TypeScript编译通过
- [x] 2.2 ExamPaper接口新增 `editedMarkdown?: string` 字段，验证编译通过

## 3. 结构化编辑器页面

- [x] 3.1 创建 `frontend/src/pages/PaperEdit.tsx`：双栏布局（左侧textarea编辑Markdown源码 + 右侧MathText实时预览），顶部显示试卷标题，底部按钮（保存草稿/预览拆分/返回），验证页面可渲�?- [x] 3.2 实现60秒自动保存：setInterval定时调用saveMarkdown，组件卸载时也触发保存，验证控制台显示自动保存日�?- [x] 3.3 实现预览区debounce 300ms：编辑后延迟300ms再渲染预览，验证大文档（27813字符）不卡顿
- [x] 3.4 创建 `PaperEdit.css`：双栏布局样式、编辑区样式、预览区样式、按钮样式，验证页面布局正常
- [x] 3.5 �?`App.tsx` 注册路由 `/papers/:id/edit`，PaperImport导入成功后跳转到此页面，验证路由可访�?
## 4. 拆分预览页面

- [x] 4.1 创建 `frontend/src/pages/SplitPreview.tsx`：调用splitPreview API，以3-block布局（题�?答案/解析）显示拆分结果列表，底部按钮（确认导�?重新编辑），验证页面渲染题目列表
- [x] 4.2 实现单题微调：每题可点击进入编辑模式修改内容/答案/解析，保存修改到本地state，验证编辑功能可�?- [x] 4.3 实现确认导入按钮：调用confirmImport API，成功后跳转到QuestionList页面，验证Question记录创建
- [x] 4.4 实现重新编辑按钮：返回PaperEdit页面，验证editedMarkdown内容保留
- [x] 4.5 创建 `SplitPreview.css`�?-block布局样式（复用QuestionList.css风格），验证样式正常
- [x] 4.6 �?`App.tsx` 注册路由 `/papers/:id/split-preview`，验证路由可访问

## 5. 渐进式流程集�?
- [x] 5.1 修改 `PaperImport.tsx`：导入成功后显示选项（直接预览拆�?进入编辑器），不再自动跳转，验证用户可选择
- [x] 5.2 试卷列表显示状态徽章：待编�?uploaded)/编辑�?editing)/待确�?split_preview)/已完�?completed)，验证状态徽章正确显�?
## 6. 端到端验�?
- [x] 6.1 后端编译通过 `npm run build`，无TypeScript错误
- [x] 6.2 前端编译通过 `npm run build`，无TypeScript错误
- [x] 6.3 E2E测试：导入PDF �?MinerU转换 �?自动预览拆分 �?18�?�?确认导入 �?QuestionList显示18�?- [x] 6.4 E2E测试：导入PDF �?MinerU转换 �?进入编辑�?�?修正Markdown �?预览拆分 �?确认导入 �?QuestionList显示修正后题�?- [x] 6.5 E2E测试：草稿保�?�?刷新页面 �?editedMarkdown内容保留
