const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  const block4 = blocks[4];
  const subParts = block4.split('【解析');
  const analysisAndContent = subParts[1].replace(/^[】\s]*/, '');
  
  // Show chars around "5." at idx 797
  const before = analysisAndContent.substring(790, 797);
  console.log('Before "5." (chars 790-797):');
  for (let i = 0; i < before.length; i++) {
    console.log('  [' + i + ']: charCode=' + before.charCodeAt(i) + ' char="' + before[i] + '"');
  }
  
  // Also test the regex
  const regex = /(^|[\n。\s])(5)\.(\s|[\u4e00-\u9fff])/;
  const m = regex.exec(analysisAndContent);
  console.log('\nRegex match:', m ? 'FOUND at ' + m.index : 'NOT FOUND');
  if (m) console.log('match[1]="' + m[1] + '" match[2]="' + m[2] + '" match[3]="' + m[3] + '"');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
