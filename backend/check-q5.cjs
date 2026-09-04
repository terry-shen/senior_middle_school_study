const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Check blocks 4 and 5 for "5." pattern
  for (let i = 4; i <= 5 && i < blocks.length; i++) {
    const block = blocks[i];
    const subParts = block.split('【解析');
    const analysisAndContent = subParts[1] ? subParts[1].replace(/^[】\s]*/, '') : '';
    
    console.log('\nBlock ' + i + ' analysis+content (first 200):');
    console.log(analysisAndContent.substring(0, 200).replace(/\n/g, '\\n'));
    
    // Search for "5." 
    const patterns = [
      '5. ',
      '5.',
    ];
    for (const p of patterns) {
      const idx = analysisAndContent.indexOf(p);
      if (idx >= 0) {
        const after = analysisAndContent.substring(idx, idx + 30);
        console.log('  Found "' + p + '" at idx=' + idx + ': ' + after.replace(/\n/g, '\\n'));
      }
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
