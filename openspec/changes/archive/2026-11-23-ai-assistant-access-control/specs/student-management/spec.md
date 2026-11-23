## MODIFIED Requirements

### Requirement: 学生账号注册

系统 SHALL 支持学生自助注册账号，或由管理员批量导入学生账号。自助注册创建的账号角色 MUST 固定为 `student`，请求中的角色字段不生效。

#### Scenario: 学生自助注册

- **WHEN** 学生填写注册信息（学号、姓名、密码）
- **THEN** 系统创建学生账号并验证学号唯一性
- **AND** 新账号角色为 `student`
- **AND** 新账号的 AI 助理访问开关默认关闭

#### Scenario: 伪造管理员角色注册

- **WHEN** 客户端在注册请求中附带 `role: "admin"`
- **THEN** 系统仍创建 `student` 角色账号，不授予管理员权限

#### Scenario: 批量导入学生

- **WHEN** 管理员上传学生名单文件（Excel/CSV）
- **THEN** 系统批量创建学生账号并返回导入结果报告
- **AND** 导入学生的 AI 助理访问开关默认关闭
