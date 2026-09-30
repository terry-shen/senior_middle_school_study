# Whole Paper Publish Specification

## Purpose
整卷试卷发布能力：将原始试卷文件直接导入并作为整卷考试发布给学生，学生下载试卷线下作答，不创建逐题答题记录。

## Requirements

### Requirement: 整卷导入
系统 SHALL 提供独立于拆分导入的"整卷导入"入口，管理员上传 PDF/Word 文件并填写元数据后存为 ExamPaper（purpose=whole_paper），不触发 MinerU 解析或题目拆分。

#### Scenario: 上传整卷文件
- **WHEN** 管理员在整卷导入页面选择 PDF 或 Word 文件并填写标题等元数据后提交
- **THEN** 系统保存原始文件到 uploads/papers/ 并创建 ExamPaper 记录（purpose=whole_paper，pdfUrl 指向文件路径，status=uploaded）

#### Scenario: 整卷导入不触发拆分
- **WHEN** 整卷导入完成
- **THEN** 系统不调用 MinerU、不执行 autoTagQuestions、不创建 Question 记录、parsedMarkdown 和 editedMarkdown 字段为空

#### Scenario: 元数据填写
- **WHEN** 管理员在整卷导入表单中填写元数据
- **THEN** 系统保存标题（必填）、年份、地区、考试类型、总分、时长、备注字段到 ExamPaper 对应字段

#### Scenario: 整卷与拆分导入入口分离
- **WHEN** 管理员访问试卷管理页面
- **THEN** 系统显示两个独立入口：「整卷导入」按钮和「拆分导入」按钮，分别跳转到不同页面

### Requirement: 整卷发布
系统 SHALL 支持管理员将整卷 ExamPaper 发布为 Exam 记录并分配给学生/班级，学生可在测验列表看到该整卷并下载原始文件。

#### Scenario: 发布整卷
- **WHEN** 管理员在试卷列表中对某张 purpose=whole_paper 的 ExamPaper 点击"发布"
- **THEN** 系统创建一条 Exam 记录（questionIds=[]，title=ExamPaper.title，totalScore=ExamPaper.totalScore，duration=ExamPaper.duration，status=published）并分配给指定学生/班级

#### Scenario: 发布时自动分配所有学生
- **WHEN** 管理员发布整卷且未指定特定学生/班级
- **THEN** 系统自动分配给所有学生角色用户（复用现有 publishExam 空参分配逻辑）

#### Scenario: 整卷 Exam 在列表中区分显示
- **WHEN** 整卷 Exam 出现在学生测验列表
- **THEN** 该条目显示试卷标题、总分、时长、状态，且因 questionIds 为空显示"下载试卷"按钮而非"进入考试"按钮

### Requirement: 原始文件下载
系统 SHALL 提供整卷原始文件下载接口，学生可通过该接口下载 PDF/Word 文件用于打印考试。

#### Scenario: 学生下载整卷
- **WHEN** 学生在测验列表点击某整卷条目的"下载试卷"按钮
- **THEN** 系统返回 ExamPaper.pdfUrl 指向的原始文件，浏览器触发下载

#### Scenario: 文件不存在时提示
- **WHEN** 学生下载整卷但 ExamPaper.pdfUrl 对应文件已丢失
- **THEN** 系统返回 404 错误并提示"试卷文件不存在"

### Requirement: 整卷不回成绩
系统 SHALL 不为整卷考试（purpose=whole_paper）创建答题记录或成绩数据。线下纸笔考试的成绩不回系统。

#### Scenario: 整卷无答题入口
- **WHEN** 学生查看整卷 Exam 详情
- **THEN** 系统不显示"开始答题"入口，仅显示"下载试卷"入口

#### Scenario: 整卷不影响错题本和掌握度
- **WHEN** 整卷发布并完成线下考试
- **THEN** 系统不为该 Exam 创建 ExamRecord 或 AnswerRecord，不影响学生的错题本、掌握度、学习激励等数据

### Requirement: ExamPaper 用途区分
ExamPaper 表 SHALL 新增 purpose 字段区分整卷用途和拆分来源用途。

#### Scenario: 整卷用途
- **WHEN** 通过整卷导入入口创建 ExamPaper
- **THEN** purpose 字段值为 'whole_paper'

#### Scenario: 拆分来源用途
- **WHEN** 通过拆分导入入口创建 ExamPaper
- **THEN** purpose 字段值为 'question_source'

#### Scenario: 现有数据默认值
- **WHEN** 数据库迁移添加 purpose 字段
- **THEN** 现有 ExamPaper 记录的 purpose 默认为 'question_source'

#### Scenario: 整卷不出现在拆分流程
- **WHEN** purpose=whole_paper 的 ExamPaper 出现在试卷列表
- **THEN** 系统不显示"编辑校准""预览拆分""确认导入"等拆分相关操作按钮，仅显示"发布""下载文件""删除"按钮
