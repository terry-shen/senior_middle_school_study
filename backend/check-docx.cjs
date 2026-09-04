const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 10 } });
  const md = paper.parsedMarkdown;
  console.log('parsedMarkdown length:', md?.length);
  
  // Count 【答案 and 【解析 markers
  const ansCount = (md.match(/【答案/g) || []).length;
  const anaCount = (md.match(/【解析/g) || []).length;
  console.log('【答案】 markers:', ansCount);
  console.log('【解析】 markers:', anaCount);
  
  // Show first 500 chars
  console.log('\nFirst 500 chars:');
  console.log(md?.substring(0, 500));
  
  // Show all "N." patterns
  console.log('\n=== Question number patterns ===');
  for (let n = 1; n <= 20; n++) {
    const idx = md.indexOf(n + '.');
    if (idx >= 0) {
      const ctx = md.substring(Math.max(0,idx-10), idx+40).replace(/\n/g, '\\n');
      console.log('Q' + n + ' at idx=' + idx + ': ' + ctx);
    }
  }
  
  // Show all 【答案 markers with context
  console.log('\n=== 【答案 positions ===');
  let pos = 0;
  let count = 0;
  while ((pos = md.indexOf('【答案', pos)) !== -1) {
    const ctx = md.substring(Math.max(0,pos-30), pos+20).replace(/\n/g, '\\n');
    console.log('ans' + (++count) + ' at ' + pos + ': ' + ctx);
    pos += 4;
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
