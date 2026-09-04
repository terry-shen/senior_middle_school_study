# Tasks: excel-knowledge-import

## 1. 后端 Excel 模板生成与解�?(1.1-1.4)

- [x] 1.1 实现 Excel 模板生成函数 `generateKPTemplate()`: �?exceljs 创建3-Sheet 工作簿（Sheet1知识点导入表含表�?2行示例、Sheet2填写说明7条规则、Sheet3完整示例20+行），设置列宽和单元格样�?- [x] 1.2 实现 Excel 解析函数 `parseKPExcel(filePath)`: 读取 .xlsx 文件，按层级1-5列解析数据行，构建知识树结构，生�?code（KP{parentId}.{序号}格式），提取描述/要点解读/建议学时字段，返回知识点列表 JSON
- [x] 1.3 实现层级一致性校�? 检测同一父节点下子节点是否使用了不同层级列，返回警告列表
- [x] 1.4 实现确认导入函数 `confirmKPImport(items)`: �?code 匹配数据库，code不存在则创建、已存在则更新（保留id和masteryLevel），返回创建数和更新数统�?
## 2. 后端 API 端点 (2.1-2.3)

- [x] 2.1 修改 `GET /api/knowledge-points/import/template`: 调用 `generateKPTemplate()` 生成 .xlsx 文件，设�?Content-Type �?Content-Disposition 返回文件下载
- [x] 2.2 修改 `POST /api/knowledge-points/import/preview`: 接收 .xlsx 文件上传（multer），调用 `parseKPExcel()` 解析，返回知识点列表 JSON + 统计（newCount/updateCount/totalCount�? 警告列表
- [x] 2.3 新增 `POST /api/knowledge-points/import/confirm`: 接收知识点列�?JSON，调�?`confirmKPImport()` 执行创建/更新，返回结果统�?
## 3. 后端清理 (3.1-3.2)

- [x] 3.1 �?`knowledge-point-import-service.ts` 删除 LLM 相关函数: `autoAnalyzeKnowledgePoints()`、`extractKnowledgePointsFromFile()`、`parseKnowledgePointsFromText()`
- [x] 3.2 �?`knowledge-points.ts` 删除旧的 `/import` POST 端点（文件上�?LLM分析）和旧的 `/import/preview` POST 端点（文件上�?LLM提取�?
## 4. 前端 API 服务 (4.1-4.2)

- [x] 4.1 重写 `knowledge-point-import-api.ts`: 新增 `downloadTemplate()` 函数（返回下载URL）、`uploadExcelForPreview(token, file)` 函数（FormData上传返回知识点列表）、`confirmImport(token, items)` 函数（提交JSON列表�?- [x] 4.2 定义 TypeScript 类型: `KPExcelItem`（code/name/level/parentCode/description/keyPoints/suggestedHours/status）、`KPPreviewResult`（items/newCount/updateCount/totalCount/warnings）、`KPConfirmResult`（created/updated/total�?
## 5. 前端导入页面 (5.1-5.6)

- [x] 5.1 重写 `KnowledgePointImport.tsx` 顶部: 模板下载按钮（点击调�?downloadTemplate 触发浏览器下载）+ Excel 文件上传区（accept=".xlsx"，单文件选择�?- [x] 5.2 实现树形预览展示: 上传成功后展示可展开/折叠的树形列表，每个节点显示 code/name/level/状态徽章（新建=绿色/更新=黄色），支持点击节点展开子节�?- [x] 5.3 实现表格编辑�? 点击节点进入编辑模式，表单字段（name/description/keyPoints/suggestedHours），保存到本�?state（不写DB�?- [x] 5.4 实现统计面板: 显示 newCount/updateCount/totalCount/警告数，确认导入按钮
- [x] 5.5 实现确认导入流程: 点击确认 �?调用 confirmImport API �?显示成功结果 �?跳转到知识点管理页面
- [x] 5.6 更新 `KnowledgePointImport.css`: 树形列表样式、状态徽章样式、编辑表单样式、统计面板样�?
## 6. 验证 (6.1-6.3)

- [x] 6.1 后端+前端构建验证: `npm run build` 均通过
- [x] 6.2 E2E 测试: 下载模板 �?填写示例数据 �?上传预览 �?编辑校准 �?确认导入 �?验证数据库知识点数量和层级正�?- [x] 6.3 增量导入测试: 再次上传相同 Excel �?预览显示全部�?更新"状�?�?确认导入 �?验证知识点数量不变（更新而非新建�?