const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Show content around each 【答案】 marker to understand question boundaries
  const ansMatches = [...md.matchAll(/【答案/g)];
  console.log('=== Question boundaries (around each 【答案】) ===');
  console.log('Total 【答案】 markers:', ansMatches.length);
  
  for (let i = 0; i < ansMatches.length; i++) {
    const idx = ansMatches[i].index;
    // Show 100 chars before the answer marker to see the question text
    const before = md.substring(Math.max(0, idx - 150), idx);
    const after = md.substring(idx, idx + 30);
    console.log('\n--- Q' + (i+1) + ' (ans at idx=' + idx + ') ---');
    console.log('BEFORE: ...' + before.replace(/\n/g, '\\n').substring(before.length - 120));
    console.log('ANSWER: ' + after.replace(/\n/g, '\\n'));
  }
  
  // Check for section headers (一、二、三、四)
  console.log('\n=== Section Headers ===');
  const sections = [...md.matchAll(/([一二三四五])、/g)];
  sections.forEach(s => {
    const ctx = md.substring(s.index, s.index + 80).replace(/\n/g, '\\n');
    console.log('Section ' + s[1] + ' at idx=' + s.index + ': ' + ctx);
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
