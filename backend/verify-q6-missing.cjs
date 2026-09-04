const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Search for "6." or "6" followed by Chinese in the FULL markdown
  console.log('=== All "6." in full markdown ===');
  let idx = 0;
  let count = 0;
  while ((idx = md.indexOf('6.', idx)) !== -1) {
    const before = md.substring(Math.max(0, idx - 20), idx);
    const after = md.substring(idx, idx + 40);
    // Skip if inside LaTeX (preceded by $ or { or ^ or _)
    const lastChar = before.length > 0 ? before[before.length-1] : '';
    if (!'$^_{}'.includes(lastChar)) {
      console.log('idx=' + idx + ' before="' + before.replace(/\n/g,'\\n').substring(before.length-15) + '" after="' + after.substring(0,30).replace(/\n/g,'\\n') + '"');
      count++;
      if (count > 10) break;
    }
    idx += 2;
  }
  
  // The real question: Q5 is "甲乙丙丁...排列组合", Q7 is "已知为第二象限角"
  // Q6 should be about something else. Let's see if Q6 content exists at all
  // Show content between Q5 answer and Q7
  
  // Also: the block 5 ends with "7. 已知 为第二象限角" — so MinerU output goes directly from Q5 to Q7
  // This means Q6 is MISSING from the MinerU output entirely
  console.log('\n=== Q6 is MISSING from MinerU output ===');
  console.log('Block 5 jumps from Q5 analysis directly to Q7');
  
  // Count how many questions we can detect
  // Each 【答案 marker = 1 question
  console.log('\nTotal 【答案 markers:', (md.match(/【答案/g) || []).length);
  console.log('Total 【解析 markers:', (md.match(/【解析/g) || []).length);
  
  // The user says 19 questions but MinerU only produced 18 answer markers
  // Q6 is likely merged with Q5 or lost during parsing
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
