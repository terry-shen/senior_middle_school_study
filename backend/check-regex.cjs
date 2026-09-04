const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  const block4 = blocks[4];
  const subParts = block4.split('【解析');
  const ac = subParts[1].replace(/^[】\s]*/, '');
  
  // The actual text at idx 797 is "5.棱台"
  // Before it is "故选B" then likely a newline then "5."
  // Let's show the raw text from 793 to 810
  console.log('Raw chars 793-810:');
  const segment = ac.substring(793, 810);
  console.log(JSON.stringify(segment));
  
  // Check if "5." is preceded by \n
  const idx = ac.indexOf('5.棱');
  if (idx >= 0) {
    const before = ac.substring(idx - 3, idx);
    console.log('\n"5.棱" at idx=' + idx + ', before chars:');
    for (let i = 0; i < before.length; i++) {
      console.log('  charCode=' + before.charCodeAt(i) + ' char="' + before[i] + '"');
    }
    
    // Test regex directly on the segment around "5."
    const testStr = ac.substring(idx - 2, idx + 5);
    console.log('\nTest string:', JSON.stringify(testStr));
    const r = /(^|[\n。\s])(5)\.(\s|[\u4e00-\u9fff])/;
    const m = r.exec(testStr);
    console.log('Match:', m ? 'YES' : 'NO');
    if (m) console.log('groups:', m[1], m[2], m[3]);
  }
  
  // Also: the regex pattern is constructed dynamically as a string
  const nextQNum = 5;
  const qNumPattern = new RegExp('(^|[\\n。\\s])(' + nextQNum + ')\\.(\\s|[\\u4e00-\\u9fff])');
  console.log('\nDynamic regex:', qNumPattern);
  const m2 = qNumPattern.exec(ac);
  console.log('Dynamic match:', m2 ? 'YES at ' + m2.index : 'NO');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
