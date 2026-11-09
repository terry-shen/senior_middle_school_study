## REMOVED Requirements

### Requirement: Word文档导入知识点
**Reason**: 知识点文档功能在 v2 整体下架，导入入口失去落点。
**Migration**: 讲义类 Word/PDF 资源改为通过网盘索引进入对应章节（NetdiskAsset + 章节映射），不再转成知识点文档。

### Requirement: 导入知识点学科选择
**Reason**: 导入功能移除后，导入时的学科选择随之失效。
**Migration**: 资源归属由章节轴承载；章节已明确归属学科，无需在导入时重复选择。
