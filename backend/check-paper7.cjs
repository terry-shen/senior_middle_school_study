const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // Check paper 7's parsedMarkdown for image refs
  const paper = await p.examPaper.findUnique({ where: { id: 7 }, select: { parsedMarkdown: true, rawContent: true } });
  if (!paper) { console.log('Paper 7 not found'); return; }
  
  const md = paper.parsedMarkdown || '';
  const lines = md.split('\n');
  console.log('parsedMarkdown length:', md.length, 'lines:', lines.length);
  
  // Find image references
  const imgLines = lines.filter(l => l.includes('![]') || l.includes('/uploads/') || l.includes('mineru-images'));
  console.log('Image ref lines:', imgLines.length);
  imgLines.forEach(l => console.log('  ', l.substring(0, 200)));
  
  // Check rawContent
  const rc = paper.rawContent || '';
  const rcImgLines = rc.split('\n').filter(l => l.includes('![]') || l.includes('/uploads/') || l.includes('mineru-images'));
  console.log('rawContent image ref lines:', rcImgLines.length);
  rcImgLines.forEach(l => console.log('  ', l.substring(0, 200)));
}
main().then(() => p.$disconnect()).catch(e => console.error(e));
