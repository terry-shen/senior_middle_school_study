const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Block 5: contains Q5 answer + analysis + Q6 content
  const block5 = blocks[5];
  console.log('Block 5 full (' + block5.length + ' chars):');
  console.log(block5.substring(0, 600).replace(/\n/g, '\\n'));
  
  // Search for "6" anywhere in block 5
  console.log('\n=== All "6." occurrences in block 5 ===');
  let idx = 0;
  while ((idx = block5.indexOf('6.', idx)) !== -1) {
    const before = block5.substring(Math.max(0, idx - 10), idx);
    const after = block5.substring(idx, idx + 30);
    console.log('idx=' + idx + ' before="' + before.replace(/\n/g,'\\n') + '" text="' + after.replace(/\n/g,'\\n') + '"');
    idx += 2;
  }
  
  // Also search for "6" followed by Chinese
  console.log('\n=== "6" followed by Chinese in block 5 ===');
  idx = 0;
  while ((idx = block5.indexOf('6', idx)) !== -1) {
    const after = block5.substring(idx, idx + 10);
    if (after.length > 1 && after.charCodeAt(1) >= 0x4e00) {
      console.log('idx=' + idx + ' text="' + after + '"');
    }
    idx += 1;
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
