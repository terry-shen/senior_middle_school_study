## MODIFIED Requirements

### Requirement: 试卷元数据管理
系统 SHALL 存储试卷的基本信息，包括来源、年份、地区、考试类型、学科、学校等。学科 SHALL 使用枚举（语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他），学校为自由文本。系统 SHALL 在导入时从文件名和内容自动提取学科关键字。整卷（purpose=whole_paper）的导入入口 SHALL 位于试卷库功能区，拆分来源（purpose=question_source）的导入入口 SHALL 位于题库管理页面。

#### Scenario: 添加试卷元数据
- **WHEN** 用户填写试卷的元数据信息
- **THEN** 系统保存元数据并支持后续检索

#### Scenario: 按条件检索试卷
- **WHEN** 用户按学科、年份、地区或考试类型筛选试卷
- **THEN** 系统返回符合条件的试卷列表

#### Scenario: 自动提取学科
- **WHEN** 系统导入文件名为"2010年高考数学陕西卷.doc"的试卷
- **THEN** 系统从文件名识别"数学"关键字并自动填充 subject=数学
- **AND** 同时提取 year/region/examType/totalScore/duration

#### Scenario: 手动补充学校信息
- **WHEN** 管理员在试卷库或题库管理列表点击"编辑元数据"
- **THEN** 系统弹出元数据编辑表单，包含 title/subject/year/region/examType/school/totalScore/duration 字段
- **AND** 学校字段为自由文本输入，保存后持久化到 ExamPaper.school

#### Scenario: 整卷导入入口位于试卷库
- **WHEN** 管理员在试卷库功能区查找整卷导入入口
- **THEN** 系统提供单文件整卷导入和文件夹递归整卷导入两个入口
- **AND** 题库管理页面 SHALL NOT 显示整卷导入入口

#### Scenario: 拆分来源导入入口位于题库管理
- **WHEN** 管理员在题库管理页面查找拆分导入入口
- **THEN** 系统提供拆分导入入口（MinerU 解析+编辑校准+拆分入库）
- **AND** 试卷库页面 SHALL NOT 显示拆分导入入口
