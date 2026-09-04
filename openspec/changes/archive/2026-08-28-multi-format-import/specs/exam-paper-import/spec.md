## MODIFIED Requirements

### Requirement: 多格式试卷导入
系统 SHALL 支持导入PDF、图片、Word文档（.docx/.doc）和纯文本（.txt）格式的考卷文件，包括手机拍照上传。

#### Scenario: 导入PDF试卷
- **WHEN** 用户上传PDF格式的考卷文件
- **THEN** 系统解析文件并创建试卷记录，显示导入进度和结果

#### Scenario: 导入图片试卷（手机拍照）
- **WHEN** 用户上传图片格式的考卷文件（手机拍照）
- **THEN** 系统使用OCR技术识别内容并创建试卷记录

#### Scenario: 批量图片导入
- **WHEN** 用户上传多张图片（试卷分页拍照）
- **THEN** 系统合并识别内容并创建完整的试卷记录

#### Scenario: 导入Word文档试卷
- **WHEN** 用户上传Word文档（.docx）格式的考卷文件
- **THEN** 系统解析文档内容（段落、表格、嵌入图片），提取文本并创建试卷记录

#### Scenario: 导入旧版Word文档试卷
- **WHEN** 用户上传旧版Word文档（.doc）格式的考卷文件
- **THEN** 系统提取文档文本内容并创建试卷记录

#### Scenario: 导入纯文本试卷
- **WHEN** 用户上传纯文本（.txt）格式的考卷文件
- **THEN** 系统自动检测文件编码（UTF-8/GBK），读取文本内容并创建试卷记录

#### Scenario: 自动路由解析器
- **WHEN** 用户上传任意支持格式的文件
- **THEN** 系统根据文件扩展名自动选择对应的解析服务（PDF解析/OCR/Word解析/文本读取），对用户透明

#### Scenario: 不支持的文件格式
- **WHEN** 用户上传不在支持列表中的文件格式（如.xlsx、.pptx）
- **THEN** 系统拒绝导入并提示用户支持的文件格式列表

## ADDED Requirements

### Requirement: 导入来源格式标识
系统 SHALL 在试卷记录中标识导入来源的文件格式，便于后续追溯和统计。

#### Scenario: 记录来源格式
- **WHEN** 系统成功导入一份试卷
- **THEN** 系统在试卷记录的 `sourceFormat` 字段中存储格式类型（pdf/image/word/txt）

#### Scenario: 按来源格式筛选
- **WHEN** 管理员按导入格式筛选试卷列表
- **THEN** 系统返回匹配该格式的试卷记录列表
