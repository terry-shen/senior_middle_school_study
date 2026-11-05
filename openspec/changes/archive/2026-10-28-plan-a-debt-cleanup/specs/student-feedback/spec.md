# student-feedback Delta

## REMOVED Requirements

### Requirement: 学生反馈入口
**Reason**: 对应路由（/api/reviews）、服务（review-service.ts）与页面已在 decouple-knowledge-from-questions 变更中删除，功能不存在。
**Migration**: 无替代功能。学生反馈题目的诉求由错题本自主录入（wrong-question-collection）承接。

### Requirement: 题目临时标注
**Reason**: 同上，标注数据表 AIContentReview 的写入方已删除。
**Migration**: 无。

### Requirement: 反馈状态跟踪
**Reason**: 路由已删。
**Migration**: 无。

### Requirement: 反馈审核流程
**Reason**: 路由已删。
**Migration**: 无。

### Requirement: 批量反馈处理
**Reason**: 路由已删。
**Migration**: 无。

### Requirement: 反馈统计分析
**Reason**: 路由已删。
**Migration**: 无。

### Requirement: 反馈数据应用
**Reason**: 路由已删。
**Migration**: 无。
