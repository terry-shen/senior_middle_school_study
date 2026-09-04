const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Get original content from parsedMarkdown for paper 8
  const paper = await prisma.examPaper.findUnique({ where: { id: 8 }, select: { parsedMarkdown: true } });
  const md = paper.parsedMarkdown;
  
  // The 5 corrupted questions - re-extract their original content from parsedMarkdown
  // Q3 (id=141): starts with "双曲线"
  // Q6 (id=144): starts with "已" (function f(x))
  // Q9 (id=147): starts with "已知抛物线"
  // Q12 (id=150): starts with "球"
  // Q14 (id=152): starts with "三棱锥"
  
  const patterns = [
    { id: 141, start: '双曲线', end: '【答案】' },
    { id: 144, start: '已 ', end: '【答案】' },  // "已 $sharp..."  
    { id: 147, start: '已知抛物线', end: '【答案】' },
    { id: 150, start: '球', end: '【答案】' },
    { id: 152, start: '三棱锥', end: '【答案】' },
  ];
  
  for (const p of patterns) {
    const startIdx = md.indexOf(p.start);
    if (startIdx >= 0) {
      const endIdx = md.indexOf(p.end, startIdx);
      if (endIdx >= 0) {
        // Get content + answer + analysis
        const nextQStart = md.search(new RegExp('\\n\\d+\\.', 'g'));
        const blockEnd = nextQStart > endIdx ? nextQStart : Math.min(endIdx + 500, md.length);
        const block = md.substring(startIdx, blockIdx => Math.min(blockIdx, startIdx + 3000));
        // Simpler: get from start to next question number or 2000 chars
        let end = endIdx + 200;
        // Find next question number
        const nextQ = md.indexOf('\n', endIdx + 200);
        if (nextQ > 0 && nextQ < startIdx + 3000) end = nextQ;
        const content = md.substring(startIdx, Math.min(end, startIdx + 2000));
        
        const q = await prisma.question.findUnique({ where: { id: p.id }, select: { answer: true, analysis: true } });
        await prisma.question.update({ where: { id: p.id }, data: { content: content.substring(0, content.indexOf('【答案】')) } });
        console.log(`Restored Q${p.id}: ${content.substring(0, 80)}... (${content.length} chars)`);
      }
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
