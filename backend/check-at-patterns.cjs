const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const paper = await p.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true } });
  if (!paper || !paper.parsedMarkdown) { console.log('No parsedMarkdown'); return; }
  const md = paper.parsedMarkdown;
  
  // Find all @xxx patterns
  const atMatches = md.match(/@\d+\.(?:png|jpg|jpeg|gif|webp)/g) || [];
  console.log('@xxx.png patterns:', atMatches.length);
  atMatches.forEach(m => console.log('  ', m));
  
  // Find all ![] patterns  
  const imgMatches = md.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  console.log('\n![](url) patterns:', imgMatches.length);
  imgMatches.forEach(m => console.log('  ', m));
  
  // Show context around first @xxx.png
  const atIdx = md.indexOf('@');
  if (atIdx >= 0) {
    console.log('\nFirst @ context (chars ' + Math.max(0,atIdx-100) + ' to ' + (atIdx+100) + '):');
    console.log(md.substring(Math.max(0,atIdx-100), atIdx+100));
  }
}
main().then(() => p.$disconnect()).catch(e => console.error(e));
