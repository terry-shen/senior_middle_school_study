const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 }, select: { rawContent: true, parsedMarkdown: true } });
  if (!paper) { console.log('No paper 6'); return; }
  
  // Check parsedMarkdown (MinerU output) for answer markers
  const md = paper.parsedMarkdown || '';
  const rc = paper.rawContent || '';
  console.log('parsedMarkdown length:', md.length);
  console.log('rawContent length:', rc.length);
  console.log('Same?', md === rc);
  
  // Count answer/analysis markers in parsedMarkdown
  const ansMd = [...md.matchAll(/【答案】/g)];
  const anaMd = [...md.matchAll(/【解析】/g)];
  console.log('\nparsedMarkdown: 【答案】 count:', ansMd.length, '【解析】 count:', anaMd.length);
  
  // Check rawContent
  const ansRc = [...rc.matchAll(/【答案】/g)];
  const anaRc = [...rc.matchAll(/【解析】/g)];
  console.log('rawContent: 【答案】 count:', ansRc.length, '【解析】 count:', anaRc.length);
  
  // Show first 3 answer contexts from parsedMarkdown
  if (ansMd.length > 0) {
    console.log('\nFirst 3 【答案】 contexts in parsedMarkdown:');
    for (let i = 0; i < Math.min(3, ansMd.length); i++) {
      const idx = ansMd[i].index;
      const context = md.substring(Math.max(0, idx - 10), idx + 40);
      console.log(`  [${i+1}] ...${context}...`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
