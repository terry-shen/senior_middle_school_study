const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 8 }, select: { parsedMarkdown: true } });
  const md = paper.parsedMarkdown;
  
  // Restore Q141 (双曲线), Q144 (已 $sharp), Q152 (三棱锥)
  const items = [
    { id: 141, start: '双曲线', endMarker: '5.已知' },
    { id: 144, start: '已 ', endMarker: '7.已知圆' },
    { id: 152, start: '三棱锥', endMarker: '15.在' },
  ];
  
  for (const item of items) {
    const startIdx = md.indexOf(item.start);
    if (startIdx < 0) { console.log(`Q${item.id}: start marker not found`); continue; }
    const endIdx = md.indexOf(item.endMarker, startIdx);
    const end = endIdx > 0 ? endIdx : Math.min(startIdx + 1500, md.length);
    const content = md.substring(startIdx, end).trim();
    await prisma.question.update({ where: { id: item.id }, data: { content } });
    console.log(`Restored Q${item.id}: ${content.substring(0, 80)}... (${content.length} chars)`);
  }
}
main().then(() => prisma.$disconnect());
