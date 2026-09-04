const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 }, select: { parsedMarkdown: true } });
  const md = paper.parsedMarkdown;
  // Check actual 【答案】 and 【解析】 format in markdown
  const ansMatches = [...md.matchAll(/【答案[】\s]*([\s\S]+?)(?=【解析】|$)/g)];
  console.log('【答案】 matches:', ansMatches.length);
  if (ansMatches[0]) console.log('  First answer:', ansMatches[0][1].trim().substring(0, 80));
  const anaMatches = [...md.matchAll(/【解析[】\s]*([\s\S]+?)(?=【答案】|\d{1,2}\.|$)/g)];
  console.log('\n【解析】 matches:', anaMatches.length);
  if (anaMatches[0]) console.log('  First analysis:', anaMatches[0][1].trim().substring(0, 80));
  // Show raw around first 【解析】
  const idx = md.indexOf('【解析');
  if (idx >= 0) console.log('\nRaw around first 【解析】:', JSON.stringify(md.substring(idx, idx + 100)));
  const idx2 = md.indexOf('【答案');
  if (idx2 >= 0) console.log('Raw around first 【答案】:', JSON.stringify(md.substring(idx2, idx2 + 100)));
  await prisma.$disconnect();
})();
