const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const qs = await p.question.findMany({ 
    where: { paperId: 6 }, 
    select: { id: true, content: true, analysis: true, answer: true }, 
    orderBy: { id: 'asc' } 
  });
  
  qs.forEach(q => {
    const allText = [q.content, q.analysis, q.answer].join(' ');
    if (allText.includes('![]') || allText.includes('@1') || allText.includes('.png') || allText.includes('/uploads/')) {
      console.log('=== Q' + q.id + ' has image refs ===');
      [q.content, q.analysis, q.answer].forEach((text, i) => {
        if (!text) return;
        const field = ['content','analysis','answer'][i];
        const lines = text.split('\n');
        lines.forEach((line, li) => {
          if (line.includes('![]') || line.includes('@1') || line.includes('.png') || line.includes('/uploads/')) {
            console.log('  ' + field + '[' + li + ']: ' + line.substring(0, 250));
          }
        });
      });
    }
  });
}
main().then(() => p.$disconnect()).catch(e => { console.error(e); process.exit(1); });
