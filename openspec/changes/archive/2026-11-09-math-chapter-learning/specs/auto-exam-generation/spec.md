## REMOVED Requirements

### Requirement: 自定义出卷参数
**Reason**: 系统改为从试卷库选整卷发布考试，不再按题型/难度/分值分布自动组卷。
**Migration**: 使用「试卷库 → 选卷 → 发布考试」流程；需要新卷时先从外部导入整卷。

### Requirement: 智能选题算法
**Reason**: 题库中的结构化题目在 v2 不再是主线数据，选题算法无可靠输入。
**Migration**: 取消自动选题，试卷由人工挑选整卷后发布。

### Requirement: 考卷预览与编辑
**Reason**: 自动组卷移除后，不存在"待预览的生成卷"这一对象。
**Migration**: 整卷内容通过试卷查看器预览；如需修改，在导入阶段使用编辑校准流程。

### Requirement: 考卷导出
**Reason**: 生成的试卷不再产生，导出生成卷的能力随之失效。
**Migration**: 使用试卷库自带的「下载」能力导出原始整卷文件。

### Requirement: 自动组卷生成考试会话
**Reason**: 考试会话统一由「整卷试卷发布」创建，不再由组卷结果生成。
**Migration**: 发布整卷考试时直接创建 ExamSession(mode='whole_paper', source='library')。

### Requirement: 出卷模板保存与复用
**Reason**: 组卷参数不再存在，模板失去内容。
**Migration**: 历史模板数据保留在库中，不再提供入口；重复出卷改为重新发布同一份整卷试卷。

### Requirement: 出卷学科强制过滤
**Reason**: 出卷动作本身被移除，学科强制校验无对象。
**Migration**: 学科维度保留在试卷库与考试发布流程上，作为筛选与校验条件。
