const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Find all 【答案】 positions and what's before each
  const ansMatches = [...md.matchAll(/【答案】/g)];
  console.log('Total 【答案】 markers:', ansMatches.length);
  ansMatches.forEach((m, i) => {
    // Look back 80 chars to find the question number
    const before = md.substring(Math.max(0, m.index - 120), m.index);
    // Find the last "N." pattern in the before text
    const qNumMatch = before.match(/(\d{1,2})\.\s/g);
    const lastNum = qNumMatch ? qNumMatch[qNumMatch.length-1] : 'none';
    // Find what's between the answer and the next question
    const afterAns = md.substring(m.index, m.index + 20);
    console.log('Ans' + (i+1) + ': idx=' + m.index + ' lastNum=' + lastNum + ' after=' + afterAns.replace(/\n/g,'\\n'));
  });
  
  // Count question-like patterns: "已知", "求", "证明" etc that indicate question starts
  const questionStarts = [...md.matchAll(/(?:^|\n)(已知|求|证明|计算|设|若|如图|某|在|已知抛物线|等比数列|等差数列|球|三棱锥|椭圆|函数|双曲线|集合|甲乙)/g)];
  console.log('\nQuestion-start patterns:', questionStarts.length);
  questionStarts.forEach((m, i) => {
    console.log('  ' + (i+1) + ': "' + m[1] + '" at idx=' + m.index);
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
