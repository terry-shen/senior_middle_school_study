const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const qs = await p.question.findMany({ 
    where: { paperId: 6 }, 
    select: { id: true, content: true, analysis: true, answer: true }, 
    orderBy: { id: 'asc' } 
  });
  
  console.log('Total questions:', qs.length);
  
  // Check each question for any image-related patterns
  qs.forEach(q => {
    const allText = [q.content || '', q.analysis || '', q.answer || ''].join('\n');
    const patterns = ['![]', '![图片]', '@1', '@2', '@3', '.png', '.jpg', '/uploads/', 'mineru', 'image', '图片'];
    const found = patterns.filter(p => allText.includes(p));
    if (found.length > 0) {
      console.log('\nQ' + q.id + ' has: ' + found.join(', '));
      // Show the relevant lines
      const lines = allText.split('\n');
      lines.forEach((line, i) => {
        if (found.some(p => line.includes(p))) {
          console.log('  L' + i + ': ' + line.substring(0, 300));
        }
      });
    }
  });
  
  // Also check if the split function uses parsedMarkdown or rawContent
  console.log('\n=== Question content length check ===');
  qs.forEach(q => {
    console.log('Q' + q.id + ': content=' + (q.content||'').length + ' answer=' + (q.answer||'').length + ' analysis=' + (q.analysis||'').length);
  });
}
main().then(() => p.$disconnect()).catch(e => { console.error(e); process.exit(1); });
