const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  const blocks = md.split('【答案');
  
  console.log('Block 0 (200 chars):');
  console.log(JSON.stringify(blocks[0].substring(0, 200)));
  
  // The regex ^\s*\d{1,2}\.\s* matches "1. " at the START
  // But block[0] starts with "# 2026 年..." (a markdown header)
  // After removing # header, we get "一、单项选择题...1. $(1-3i)^2=$"
  // The "一、" regex removes the section header
  // Then "1. " regex removes "1. " — but what's left?
  
  let step1 = blocks[0].replace(/^#[^#]*\n/g, '');
  console.log('\nAfter # header removal:');
  console.log(JSON.stringify(step1.substring(0, 150)));
  
  let step2 = step1.replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '');
  console.log('\nAfter section header removal:');
  console.log(JSON.stringify(step2.substring(0, 150)));
  
  let step3 = step2.replace(/^\s*\d{1,2}\.\s*/, '').trim();
  console.log('\nAfter number removal:');
  console.log('Length:', step3.length);
  console.log(JSON.stringify(step3.substring(0, 150)));
  
  // The problem: the section header "一、单项选择题(本题共 8小题，每小题5分，共40分。)1. $(1-3i)^2=$"
  // is ALL on ONE LINE. The regex ^[一二三四五六七八九十]+、[^\n]*\n removes the ENTIRE line
  // including "1. $(1-3i)^2=$" because it's on the same line!
  
  console.log('\n=== Fix: need to split section header from question content ===');
  // Better approach: remove section header but keep the rest of the line
  let step2b = step1.replace(/^[一二三四五六七八九十]+、[^\n]*(?=【|\d{1,2}\.)/g, '').trim();
  console.log('After section header removal (fixed):');
  console.log(JSON.stringify(step2b.substring(0, 150)));
  
  let step3b = step2b.replace(/^\s*\d{1,2}\.\s*/, '').trim();
  console.log('\nAfter number removal (fixed):');
  console.log('Length:', step3b.length);
  console.log(JSON.stringify(step3b.substring(0, 150)));
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
