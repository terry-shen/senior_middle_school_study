# API 参考文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证**: JWT Bearer Token（`Authorization: Bearer <token>`）
- **格式**: JSON

## 认证模块 (`/api/auth`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /auth/register | 学生注册 | 公开 |
| POST | /auth/login | 学生登录 | 公开 |
| GET | /auth/me | 获取当前用户 | 已登录 |
| POST | /auth/logout | 登出 | 已登录 |

## LLM模型管理 (`/api/llm`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /llm/models | 获取模型列表 | 管理员 |
| POST | /llm/models | 添加模型配置 | 管理员 |
| PUT | /llm/models/:id | 更新模型配置 | 管理员 |
| DELETE | /llm/models/:id | 删除模型配置 | 管理员 |
| POST | /llm/models/:id/test | 测试模型连接 | 管理员 |

## Prompt模板 (`/api/prompts`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /prompts/templates | 获取模板列表 | 管理员 |
| POST | /prompts/templates | 创建模板 | 管理员 |
| PUT | /prompts/templates/:id | 更新模板 | 管理员 |
| DELETE | /prompts/templates/:id | 删除模板 | 管理员 |

## 学生管理 (`/api/students`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /students | 学生列表（分页） | 管理员 |
| GET | /students/:id | 学生详情 | 管理员/本人 |
| PUT | /students/:id | 更新学生 | 管理员/本人 |
| DELETE | /students/:id | 删除学生 | 管理员 |
| POST | /students/import/csv | CSV批量导入 | 管理员 |
| POST | /students/import/json | JSON批量导入 | 管理员 |
| GET | /students/export/csv | 导出CSV | 管理员 |

## 班级管理 (`/api/classes`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /classes | 创建班级 | 管理员 |
| GET | /classes | 班级列表 | 管理员 |
| GET | /classes/:id | 班级详情 | 管理员 |
| PUT | /classes/:id | 更新班级 | 管理员 |
| DELETE | /classes/:id | 删除班级 | 管理员 |
| POST | /classes/:id/assign/:studentId | 分配学生 | 管理员 |
| POST | /classes/:id/unassign/:studentId | 移除学生 | 管理员 |

## 知识点管理 (`/api/knowledge-points`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /knowledge-points | 创建知识点 | 管理员 |
| GET | /knowledge-points | 知识点列表 | 已登录 |
| GET | /knowledge-points/:id | 知识点详情 | 已登录 |
| GET | /knowledge-points/tree/full | 树形结构 | 已登录 |
| GET | /knowledge-points/:id/ancestors | 祖先链 | 已登录 |
| PUT | /knowledge-points/:id | 更新知识点 | 管理员 |
| DELETE | /knowledge-points/:id | 删除知识点 | 管理员 |
| POST | /knowledge-points/:id/relations | 添加关系 | 管理员 |
| DELETE | /knowledge-points/:id/relations/:relationId | 删除关系 | 管理员 |

## 试卷管理 (`/api/papers`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /papers/import | 导入试卷（图片/PDF） | 管理员 |
| POST | /papers/:id/split | 拆分题目 | 管理员 |
| GET | /papers | 试卷列表 | 已登录 |
| GET | /papers/:id | 试卷详情 | 已登录 |
| PUT | /papers/:id | 更新试卷 | 管理员 |
| DELETE | /papers/:id | 删除试卷 | 管理员 |
| GET | /papers/:id/questions | 试卷题目列表 | 已登录 |
| POST | /papers/export/pdf | 导出PDF | 管理员 |
| POST | /papers/export/word | 导出Word | 管理员 |

## 题目管理 (`/api/questions`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /questions/all | 所有题目（分页+筛选） | 已登录 |
| GET | /questions/:id | 题目详情 | 已登录 |
| PUT | /questions/:id | 更新题目 | 管理员 |
| POST | /questions/batch/update | 批量更新 | 管理员 |
| POST | /questions/batch/delete | 批量删除 | 管理员 |
| GET | /questions/quality/report | 质量报告 | 管理员 |
| GET | /questions/quality/stats | 质量统计 | 管理员 |

## AI分析 (`/api/analysis`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /analysis/identify-knowledge-points | 知识点识别 | 管理员 |
| POST | /analysis/generate-analysis | 生成解析 | 管理员 |
| POST | /analysis/generate-answer | 生成答案 | 管理员 |
| POST | /analysis/generate-summary | 生成摘要 | 管理员 |
| POST | /analysis/extract-metadata | 提取元数据 | 管理员 |
| POST | /analysis/question/:id | 分析题目 | 管理员 |
| POST | /analysis/batch | 批量分析 | 管理员 |

## AI审核 (`/api/reviews`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /reviews | 创建审核 | 管理员 |
| GET | /reviews | 审核列表 | 管理员 |
| GET | /reviews/:id | 审核详情 | 管理员 |
| POST | /reviews/:id/submit | 提交审核结果 | 管理员 |
| POST | /reviews/:id/apply | 应用审核内容 | 管理员 |
| GET | /reviews/stats | 审核统计 | 管理员 |

## 难度管理 (`/api/difficulty`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /difficulty/assess/:id | 评估难度 | 管理员 |
| POST | /difficulty/batch-assess | 批量评估 | 管理员 |
| POST | /difficulty/adjust/:id | 手动调整 | 管理员 |
| GET | /difficulty/adjustments/:questionId | 调整历史 | 已登录 |
| GET | /difficulty/stats | 难度统计 | 已登录 |
| GET | /difficulty/by-knowledge-point | 按知识点分布 | 已登录 |

## 自动出卷 (`/api/exams`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /exams/generate | 生成试卷 | 管理员 |
| POST | /exams/preview | 预览试卷 | 管理员 |
| GET | /exams | 试卷列表 | 已登录 |
| GET | /exams/:id | 试卷详情 | 已登录 |
| POST | /exams/:id/replace | 替换题目 | 管理员 |
| GET | /exams/:id/export/pdf | 导出PDF | 管理员 |
| GET | /exams/:id/export/word | 导出Word | 管理员 |
| GET | /exams/templates | 模板列表 | 管理员 |
| POST | /exams/templates | 保存模板 | 管理员 |

## 在线测验 (`/api/online-exams`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /online-exams | 创建测验 | 管理员 |
| POST | /online-exams/:id/publish | 发布测验 | 管理员 |
| GET | /online-exams | 测验列表 | 已登录 |
| GET | /online-exams/:id | 测验详情 | 已登录 |
| POST | /online-exams/:id/start | 开始答题 | 学生 |
| POST | /online-exams/:id/answer | 保存答案 | 学生 |
| POST | /online-exams/:id/upload-image | 上传图片答案 | 学生 |
| POST | /online-exams/:id/submit | 提交测验 | 学生 |
| GET | /online-exams/:id/record | 答题记录 | 已登录 |

## AI批改 (`/api/grading`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /grading/grade/:recordId | 批改单题 | 管理员 |
| POST | /grading/batch/:examRecordId | 批量批改 | 管理员 |
| POST | /grading/adjust/:recordId | 调整分数 | 管理员 |
| GET | /grading/stats | 批改统计 | 管理员 |

## 掌握度评估 (`/api/mastery`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /mastery/update | 更新掌握度 | 系统 |
| GET | /mastery/student/:studentId | 学生掌握度 | 已登录 |
| GET | /mastery/weaknesses/:studentId | 薄弱点 | 已登录 |
| GET | /mastery/history/:studentId/:knowledgePointId | 历史趋势 | 已登录 |
| POST | /mastery/report/:studentId | 生成报告 | 已登录 |
| GET | /mastery/reports/:studentId | 报告列表 | 已登录 |
| GET | /mastery/stats/:studentId | 统计 | 已登录 |
| GET | /mastery/knowledge-map/:studentId | 知识地图数据 | 已登录 |
| GET | /mastery/knowledge-map/class/:classId | 班级知识地图 | 管理员 |

## 错题本 (`/api/wrong-questions`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /wrong-questions | 错题列表 | 已登录 |
| GET | /wrong-questions/stats | 统计 | 已登录 |
| GET | /wrong-questions/practice-history | 练习历史 | 已登录 |
| POST | /wrong-questions/practice | 记录练习 | 已登录 |
| PUT | /wrong-questions/:id/status | 更新复习状态 | 已登录 |
| GET | /wrong-questions/:id/variations | 变式题列表 | 已登录 |
| POST | /wrong-questions/:id/variations | 生成变式题 | 已登录 |
| GET | /wrong-questions/export/pdf | 导出PDF | 已登录 |
| GET | /wrong-questions/export/word | 导出Word | 已登录 |

## 个性化推荐 (`/api/recommendation`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /recommendation/daily | 每日推荐 | 已登录 |
| POST | /recommendation/generate | 生成推荐 | 已登录 |
| GET | /recommendation/history | 推荐历史 | 已登录 |
| GET | /recommendation/stats | 效果统计 | 已登录 |
| GET | /recommendation/:id | 推荐详情 | 已登录 |
| POST | /recommendation/:id/feedback | 反馈 | 已登录 |
| POST | /recommendation/:id/start-practice | 开始练习 | 已登录 |
| GET | /recommendation/practice/:sessionId | 练习详情 | 已登录 |
| POST | /recommendation/practice/:sessionId/answer | 保存答案 | 已登录 |
| POST | /recommendation/practice/:sessionId/complete | 完成练习 | 已登录 |
| GET | /recommendation/strategies/all | 策略列表 | 已登录 |
| PUT | /recommendation/strategies/:id/default | 设置默认 | 管理员 |
| POST | /recommendation/learning-path/generate | 生成学习路径 | 已登录 |
| GET | /recommendation/learning-path/active | 当前路径 | 已登录 |
| PUT | /recommendation/learning-path/:pathId/item/:itemId | 更新路径项 | 已登录 |

## 模拟考试 (`/api/mock-exams`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /mock-exams | 创建模拟考试 | 管理员 |
| GET | /mock-exams | 考试列表 | 已登录 |
| GET | /mock-exams/:id | 考试详情 | 已登录 |
| POST | /mock-exams/:id/publish | 发布考试 | 管理员 |
| DELETE | /mock-exams/:id | 删除考试 | 管理员 |
| POST | /mock-exams/:id/start | 开始考试 | 学生 |
| POST | /mock-exams/:id/answer | 保存答案 | 学生 |
| POST | /mock-exams/:id/mark/:questionId | 标记题目 | 学生 |
| POST | /mock-exams/:id/submit | 提交考试 | 学生 |
| GET | /mock-exams/:id/result | 成绩详情 | 已登录 |
| GET | /mock-exams/:id/benchmark | 对标分析 | 已登录 |
| GET | /mock-exams/:id/wrong-analysis | 错题分析 | 已登录 |
| GET | /mock-exams/history/all | 考试历史 | 已登录 |

## 学习激励 (`/api/incentive`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /incentive/badges | 徽章列表 | 已登录 |
| GET | /incentive/badges/earned | 已获得徽章 | 已登录 |
| POST | /incentive/badges/seed | 初始化徽章 | 管理员 |
| POST | /incentive/badges/check | 检查徽章 | 系统 |
| POST | /incentive/check-in | 每日打卡 | 已登录 |
| GET | /incentive/check-in/today | 今日打卡状态 | 已登录 |
| GET | /incentive/check-in/calendar | 打卡日历 | 已登录 |
| GET | /incentive/stats | 学习统计 | 已登录 |
| GET | /incentive/stats/mastery-curve | 掌握度曲线 | 已登录 |
| GET | /incentive/leaderboard/class/:classId | 班级排行榜 | 已登录 |
| GET | /incentive/leaderboard/global | 全局排行榜 | 已登录 |
| GET | /incentive/achievements | 成就墙 | 已登录 |
| GET | /incentive/notifications | 通知列表 | 已登录 |
| PUT | /incentive/notifications/:id/read | 标记已读 | 已登录 |
| POST | /incentive/challenges | 创建挑战 | 管理员 |
| GET | /incentive/challenges | 挑战列表 | 已登录 |
| GET | /incentive/challenges/:id | 挑战详情 | 已登录 |
| POST | /incentive/challenges/:id/start | 启动挑战 | 管理员 |
| POST | /incentive/challenges/:id/end | 结束挑战 | 管理员 |
| POST | /incentive/challenges/:id/join | 加入挑战 | 已登录 |
| GET | /incentive/challenges/:id/leaderboard | 挑战排行榜 | 已登录 |

## 错误响应格式

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 分页响应格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
