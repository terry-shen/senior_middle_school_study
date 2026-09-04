const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Show block 0 content
  console.log('Block 0:');
  console.log(JSON.stringify(blocks[0]));
  
  // Test the regex step by step
  let s = blocks[0];
  let s1 = s.replace(/^#[^\n]*\n/g, '');
  console.log('\nAfter # header removal:');
  console.log(JSON.stringify(s1));
  
  // The section header is "一、单项选择题(本题共 8小题，每小题5分，共40分。)1. $(1-3i)^2=$"
  // It contains digits! So [^0-9]* stops at "8" in "8小题"
  // We need a different approach: remove the entire section header line, but keep question content
  
  // Better: find the first occurrence of a question number pattern "N." and keep from there
  let s2 = s1.replace(/^[一二三四五六七八九十]+、[^]*?(?=\d{1,2}\.\s)/, '');
  console.log('\nAfter section header removal (lookahead):');
  console.log(JSON.stringify(s2.substring(0, 200)));
  
  // Even simpler: just find "1. " in the text and keep everything from there
  const q1Match = s1.match(/1\.\s/);
  if (q1Match) {
    console.log('\nFound "1. " at index:', q1Match.index);
    let s3 = s1.substring(q1Match.index + 3).trim(); // Skip "1. "
    console.log('Q1 content:', JSON.stringify(s3.substring(0, 200)));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
