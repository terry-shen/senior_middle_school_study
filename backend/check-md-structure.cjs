const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true } });
  if (!paper || !paper.parsedMarkdown) { console.log('No paper #6 or no markdown'); return; }
  const md = paper.parsedMarkdown;
  console.log('Markdown length:', md.length);
  console.log('\n=== First 2000 chars ===');
  console.log(md.substring(0, 2000));
  // Count question-like patterns
  const numbered = [...md.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+(?!\d)/g)];
  console.log('\n\nNumbered question matches:', numbered.length);
  numbered.slice(0, 10).forEach(m => console.log('  Q' + m[1] + ' at pos', m.index));
  const answerMarkers = [...md.matchAll(/【答案/g)];
  console.log('\n【答案】 markers:', answerMarkers.length);
  const analysisMarkers = [...md.matchAll(/【解析/g)];
  console.log('【解析】 markers:', analysisMarkers.length);
  const imgRefs = [...md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  console.log('Image refs:', imgRefs.length);
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
