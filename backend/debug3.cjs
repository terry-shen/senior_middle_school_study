const { PrismaClient } = require('@prisma/client');
const { splitQuestionsFromMarkdown } = require('./dist/services/question-splitting-service');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 } });
  const md = paper.parsedMarkdown;
  
  // Check if preprocessing is working
  const processedMd = md.replace(/。(\d{1,2}\.\s)/g, '。\n$1');
  console.log('Original md length:', md.length);
  console.log('Processed md length:', processedMd.length);
  console.log('Difference:', processedMd.length - md.length, 'chars added');
  
  // Check 【解析】 in processed markdown
  const idx1 = md.indexOf('【解析');
  const idx2 = processedMd.indexOf('【解析');
  console.log('Jiexi in original at:', idx1);
  console.log('Jiexi in processed at:', idx2);
  
  // Split and check Q1 rawContent for 【解析】
  const result = await splitQuestionsFromMarkdown(md);
  console.log('\nQuestions:', result.questions.length);
  
  // Check if Q1 object has analysis field
  const q1 = result.questions[0];
  console.log('Q1 keys:', Object.keys(q1));
  console.log('Q1 analysis:', q1.analysis);
  console.log('Q1 correctAnswer:', q1.correctAnswer);
  
  // Manually check what rawContent the code processes for Q1
  // Q1 starts at match index, ends at next match
  const regex = /(?:^|\n)\s*(\d{1,2})\.\s*(?![\d.])/g;
  let m;
  const matches = [];
  while ((m = regex.exec(processedMd)) !== null) {
    if (parseInt(m[1]) >= 1 && parseInt(m[1]) <= 50) {
      matches.push({ num: parseInt(m[1]), index: m.index });
    }
  }
  console.log('\nRegex matches:', matches.length);
  if (matches.length >= 2) {
    const start = matches[0].index;
    const end = matches[1].index;
    const raw = processedMd.substring(start, end).trim();
    console.log('Q1 raw segment (first 500 chars):');
    console.log(raw.substring(0, 500));
    console.log('\nQ1 raw has jiexi:', raw.includes('【解析'));
    console.log('Q1 raw has daan:', raw.includes('【答案'));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
