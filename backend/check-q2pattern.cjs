const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Check block 1 for "2." pattern
  const block1 = blocks[1];
  const subParts = block1.split('【解析');
  const analysisAndContent = subParts[1] ? subParts[1].replace(/^[】\s]*/, '') : '';
  
  console.log('Block 1 analysis+content (first 300):');
  console.log(analysisAndContent.substring(0, 300));
  
  // Search for "2." with various patterns
  const patterns = [
    { name: '2. ', regex: /2\.\s/ },
    { name: '2. (no space after)', regex: /2\.(?=[\u4e00-\u9fff])/ },  // "2.中"
    { name: '\\n2.', regex: /\n2\./ },
    { name: '。2.', regex: /。2\./ },
  ];
  
  patterns.forEach(p => {
    const m = p.regex.exec(analysisAndContent);
    if (m) {
      console.log('\nFound "' + p.name + '" at idx=' + m.index + ': ' + analysisAndContent.substring(m.index, m.index + 30).replace(/\n/g, '\\n'));
    } else {
      console.log('\n"' + p.name + '": NOT FOUND');
    }
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
