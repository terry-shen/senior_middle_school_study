const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p10 = await prisma.question.findMany({ where: { paperId: 10 }, orderBy: { questionNumber: 'asc' } });
  
  // The DOCX is 2026年全国卷l数学卷 (全国一卷), which is a DIFFERENT exam from paper 9 (全国二卷)
  // User said this has 15 questions. We have 17.
  // Let's check which questions might be false splits:
  
  // Q14 has "四、解答题" section header mixed in — it's still a valid question but with extra text
  // Q15 has "三、填空题" section header — it might be a fill-in-the-blank question with header mixed in
  
  // Actually, looking at the content:
  // Q1-Q8: 8 choice questions (单项选择题)
  // Q9-Q11: 3 multi-choice questions (多项选择题)
  // Q12-Q14: 3 fill-in-blank questions (填空题)  
  // Q15-Q17: 3 essay questions (解答题)
  // Total: 8+3+3+3 = 17
  // But user said 15. Maybe 8+3+2+2 = 15? Or the DOCX has different structure.
  
  // Let's also check for cross-paper duplicates (paper 9 vs paper 10)
  const p9 = await prisma.question.findMany({ where: { paperId: 9 }, orderBy: { questionNumber: 'asc' } });
  
  console.log('=== Cross-paper comparison ===');
  console.log('Paper 9 (全国二卷):', p9.length, 'questions');
  console.log('Paper 10 (全国一卷):', p10.length, 'questions');
  
  // These are DIFFERENT exam papers (一卷 vs 二卷), so there should be NO duplicates!
  // User said "重复的题不要重复导入" — but these are different papers.
  // Unless the user means some questions appear in both papers.
  
  // Let's check for content overlap
  let dupCount = 0;
  for (const q10 of p10) {
    const q10Start = q10.content?.substring(0, 30).replace(/\s/g, '');
    for (const q9 of p9) {
      const q9Content = q9.content || '';
      // Check if q10's content appears in q9's content
      if (q9Content.includes(q10Start) && q10Start.length > 10) {
        console.log('  DUPLICATE: P10-Q' + q10.questionNumber + ' matches P9-Q' + q9.questionNumber);
        console.log('    P10: ' + q10.content?.substring(0, 50));
        console.log('    P9:  ' + q9Content.substring(0, 50));
        dupCount++;
      }
    }
  }
  console.log('\nDuplicates found:', dupCount);
  
  if (dupCount === 0) {
    console.log('\nNo duplicates — papers are different exams (一卷 vs 二卷)');
    console.log('Paper 9:', p9.length, 'questions (全国二卷)');
    console.log('Paper 10:', p10.length, 'questions (全国一卷)');
    console.log('Total unique:', p9.length + p10.length);
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
