const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const paper = await p.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true, rawContent: true } });
  if (!paper) { console.log('Paper 6 not found'); return; }
  
  const md = paper.parsedMarkdown || '';
  const rc = paper.rawContent || '';
  
  console.log('parsedMarkdown length:', md.length);
  console.log('rawContent length:', rc.length);
  
  // Check for image references in parsedMarkdown
  const imgPatterns = ['![]', '@', '.png', '/uploads/', 'mineru-images', 'image'];
  console.log('\n=== parsedMarkdown image refs ===');
  const lines = md.split('\n');
  lines.forEach((line, i) => {
    if (imgPatterns.some(p => line.includes(p))) {
      console.log('L' + i + ': ' + line.substring(0, 300));
    }
  });
  
  // Check rawContent for image refs
  console.log('\n=== rawContent image refs ===');
  const rcLines = rc.split('\n');
  rcLines.forEach((line, i) => {
    if (imgPatterns.some(p => line.includes(p))) {
      console.log('L' + i + ': ' + line.substring(0, 300));
    }
  });
  
  // Count @ followed by digits pattern
  const atMatches = md.match(/@\d+\.(?:png|jpg|jpeg)/g) || [];
  console.log('\n@xxx.png patterns in parsedMarkdown:', atMatches.length);
  atMatches.slice(0, 10).forEach(m => console.log('  ', m));
}
main().then(() => p.$disconnect()).catch(e => { console.error(e); process.exit(1); });
