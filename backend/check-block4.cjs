const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Block 4 contains Q4 answer + Q4 analysis + Q5+Q6 content?
  console.log('Block 4 (' + blocks[4].length + ' chars):');
  console.log(blocks[4].substring(0, 800).replace(/\n/g, '\\n'));
  
  // Check: does block 4 contain "6."?
  const idx6 = blocks[4].indexOf('6.');
  console.log('\n"6." in block 4 at idx=' + idx6);
  if (idx6 >= 0) {
    console.log('Context: ' + blocks[4].substring(Math.max(0,idx6-20), idx6+40).replace(/\n/g,'\\n'));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
