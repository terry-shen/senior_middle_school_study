const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  // Find ALL "N." patterns at start of line or after \n\n
  const allMatches = [...md.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+(?=[^\d])/g)];
  console.log('All line-start N. matches:', allMatches.length);
  allMatches.forEach(m => {
    const n = parseInt(m[1]);
    const preview = md.substring(m.index, m.index + 80).replace(/\n/g, ' ');
    console.log('  N=' + n + ' idx=' + m.index + ' preview: ' + preview);
  });
  
  // Also try finding all "N." preceded by \n\n or just \n
  const allMatches2 = [...md.matchAll(/\n\n(\d{1,2})\.\s/g)];
  console.log('\nDouble-newline N. matches:', allMatches2.length);
  allMatches2.forEach(m => {
    console.log('  N=' + m[1] + ' idx=' + m.index);
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
