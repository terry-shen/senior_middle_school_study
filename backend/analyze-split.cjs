const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 15 } });
  if (!paper || !paper.parsedMarkdown) { console.log('No paper #15 or no parsedMarkdown'); return; }
  const md = paper.parsedMarkdown;
  console.log('parsedMarkdown length:', md.length);
  console.log('=== First 2000 chars ===');
  console.log(md.substring(0, 2000));
  console.log('\n=== Marker counts ===');
  const ansCount = (md.match(/【答案/g) || []).length;
  const anaCount = (md.match(/【解析/g) || []).length;
  console.log('【答案 markers:', ansCount);
  console.log('【解析 markers:', anaCount);
  
  // Show all 【答案 positions
  let pos = 0;
  const positions = [];
  while ((pos = md.indexOf('【答案', pos)) !== -1) {
    positions.push(pos);
    pos++;
  }
  console.log('\n=== 【答案 positions ===');
  positions.forEach((p, i) => {
    const ctx = md.substring(Math.max(0, p - 40), p + 30).replace(/\n/g, ' ');
    console.log(`  [${i+1}] pos=${p}: ...${ctx}...`);
  });

  // Show split by 【答案
  const blocks = md.split('【答案');
  console.log('\n=== Blocks after splitting by 【答案 ===');
  console.log('Block count:', blocks.length);
  blocks.forEach((b, i) => {
    const preview = b.substring(0, 80).replace(/\n/g, ' ');
    console.log(`  Block[${i}]: ${b.length} chars, preview: ${preview}`);
  });
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
