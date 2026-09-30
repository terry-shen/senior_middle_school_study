## Purpose
将整卷作为完整生命周期（导入→分类→发布→回收→批改）独立成"试卷库"功能区，与拆分导入解耦，支持按学科/年份/省份/学校多维筛选，一键发布为模拟考试并监控回收批改进度。

## Requirements

### Requirement: 试卷库整卷导入
系统 SHALL 在试卷库功能区内提供整卷导入入口（单文件上传 + 文件夹递归选择），导入的试卷 SHALL 标记 purpose=whole_paper，不进行 MinerU 解析和题目拆分，直接存原始文件供学生下载打印。

#### Scenario: 单文件整卷导入
- **WHEN** 管理员在试卷库页面选择单个 PDF/Word/图片文件上传
- **THEN** 系统创建 ExamPaper 记录（purpose=whole_paper，pdfUrl 指向原始文件），不调用 MinerU，不创建 Question 记录

#### Scenario: 文件夹递归整卷导入
- **WHEN** 管理员在试卷库页面选择文件夹上传
- **THEN** 系统递归枚举目录及其全部子目录下的支持格式文件（PDF/Word/TXT/图片）
- **AND** 杂项文件（非试卷格式）被跳过并在提示中告知数量
- **AND** 文件数量超过单批上限时系统自动分批上传（每批 ≤20 文件），全部结果累积展示
- **AND** 每个文件创建独立的 ExamPaper（purpose=whole_paper），导入结果表显示成功/失败状态及相对路径

#### Scenario: 整卷导入不支持拆分
- **WHEN** 管理员在试卷库页面导入整卷
- **THEN** 系统 SHALL NOT 调用 MinerU 解析、SHALL NOT 调用 autoTagQuestions、SHALL NOT 创建 Question 记录
- **AND** 试卷状态保持 uploaded，待管理员手动补充元数据后发布

### Requirement: 试卷库多维元数据分类
系统 SHALL 为整卷试卷提供学科、年份、省份、考试类型、学校多维元数据，支持自动提取（从文件名+内容）和手动编辑补充。学科 SHALL 使用枚举（语文/数学/英语/物理/化学/生物/政治/历史/地理/理综/文综/其他），学校为自由文本。

#### Scenario: 自动提取学科
- **WHEN** 管理员上传文件名为"2010年高考数学陕西卷.doc"的整卷
- **THEN** 系统从文件名识别"数学"关键字并自动填充 subject=数学
- **AND** 同时提取 year=2010、region=陕西、examType=高考

#### Scenario: 自动提取理综文综
- **WHEN** 管理员上传文件名为"2010年高考理综全国卷.doc"的整卷
- **THEN** 系统识别"理综"关键字并填充 subject=理综

#### Scenario: 手动补充学校信息
- **WHEN** 管理员在试卷库列表点击"编辑元数据"
- **THEN** 系统弹出元数据编辑表单，包含 title/subject/year/region/examType/school/totalScore/duration 字段
- **AND** 学校字段为自由文本输入，保存后持久化到 ExamPaper.school

#### Scenario: 多维筛选试卷
- **WHEN** 管理员在试卷库页面同时选择学科=数学、年份=2010、省份=陕西
- **THEN** 系统返回同时满足三个条件的整卷列表
- **AND** 筛选条件可任意组合，未选的条件不参与筛选

#### Scenario: 学科分布统计
- **WHEN** 管理员在试卷库页面查看分类概览
- **THEN** 系统显示各学科试卷数量分布（如数学 30 张、英语 25 张），便于按学科批量管理

### Requirement: 试卷库一键发布为模拟考试
系统 SHALL 在试卷库列表行内提供"发布考试"按钮，点击后创建 MockExam（关联 paperId）并自动分配学生，发布后学生可在模拟考试页面看到该考试并下载试卷线下作答。

#### Scenario: 发布整卷模拟考试
- **WHEN** 管理员在试卷库列表点击某张整卷的"发布考试"按钮
- **THEN** 系统创建 MockExam（paperId 指向该 ExamPaper，questionIds 为空数组，standard=custom，status=draft）
- **AND** 系统自动将全部学生分配到该模拟考试
- **AND** 创建后 MockExam 状态为 published，学生立即可见

#### Scenario: 发布时元数据传递
- **WHEN** 管理员发布整卷模拟考试
- **THEN** MockExam.totalScore 取自 ExamPaper.totalScore，duration 取自 ExamPaper.duration
- **AND** 若试卷缺元数据则使用默认值（totalScore=100，duration=120）

#### Scenario: 取消发布
- **WHEN** 管理员在试卷库列表点击已发布卷的"取消发布"
- **THEN** 系统删除关联的 MockExam（含 studentAnswers），试卷回到 uploaded 状态

### Requirement: 回收批改进度监控
系统 SHALL 在试卷库功能区内提供"回收批改"tab，显示每张已发布整卷的学生答题纸回收进度和批改状态，便于老师集中批阅。

#### Scenario: 查看回收进度
- **WHEN** 管理员切换到试卷库的"回收批改"tab
- **THEN** 系统显示已发布整卷列表，每行显示：试卷标题、已上传/未上传学生数、已批改/待批改数
- **AND** 点击试卷行进入该卷的答题纸列表（AnswerSheet 列表，按 status 筛选 submitted/graded）

#### Scenario: 直接进入批注阅卷
- **WHEN** 管理员在回收批改列表点击某张答题纸的"批改"按钮
- **THEN** 系统跳转到答题纸详情页（Canvas 批注工具 + 评分表单 + 评语）

#### Scenario: 未回收答题纸提示
- **WHEN** 某已发布整卷尚无学生上传答题纸
- **THEN** 回收批改列表显示"暂无回收"，提示老师可催促学生上传

### Requirement: 试卷库与题库管理分离
系统 SHALL 将整卷导入（试卷库）与拆分导入（题库管理）分离为两个独立功能区，互不混杂。

#### Scenario: 试卷库仅显示整卷
- **WHEN** 管理员访问试卷库页面
- **THEN** 系统仅显示 purpose=whole_paper 的试卷，不显示拆分来源（purpose=question_source）的试卷

#### Scenario: 题库管理仅显示拆分来源
- **WHEN** 管理员访问题库管理页面
- **THEN** 系统仅显示 purpose=question_source 的试卷及其拆分题目，不显示整卷

#### Scenario: 整卷入口不在题库管理
- **WHEN** 管理员在题库管理页面查找整卷导入入口
- **THEN** 系统 SHALL NOT 显示整卷导入/文件夹整卷导入入口（这些入口在试卷库功能区）
