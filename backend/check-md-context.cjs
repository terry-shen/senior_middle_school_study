const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const paper = await p.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true } });
  if (!paper || !paper.parsedMarkdown) { console.log('No parsedMarkdown'); return; }
  const md = paper.parsedMarkdown;
  
  // Show lines around each image reference
  const lines = md.split('\n');
  console.log('Total lines:', lines.length);
  
  lines.forEach((line, i) => {
    if (line.includes('![]') || line.includes('图片') || line.includes('@') || line.includes('image') || line.includes('.png') || line.includes('.jpg')) {
      // Show 1 line before and after for context
      if (i > 0) console.log('L' + (i-1) + ': ' + lines[i-1].substring(0, 200));
      console.log('L' + i + ': ' + line.substring(0, 200));
      console.log('---');
    }
  });
  
  // Also search for @ pattern specifically
  const atPattern = md.match(/@[\w\d]+/g) || [];
  console.log('\nAll @xxx patterns:', atPattern.length);
  // Show unique ones
  const unique = [...new Set(atPattern)];
  console.log('Unique @ patterns:', unique.slice(0, 20).join(', '));
}
main().then(() => p.$disconnect()).catch(e => console.error(e));
