const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p9 = await prisma.question.findMany({ where: { paperId: 9 }, orderBy: { questionNumber: 'asc' } });
  const p10 = await prisma.question.findMany({ where: { paperId: 10 }, orderBy: { questionNumber: 'asc' } });
  
  // Check for duplicates: compare first 30 chars of content
  // Paper 9 content is shifted (includes previous analysis), so we need to look at the actual question text
  // Paper 10 content is clean (starts with question text)
  
  console.log('=== Dedup Analysis ===');
  console.log('Paper 9:', p9.length, 'questions');
  console.log('Paper 10:', p10.length, 'questions');
  
  // Show paper 10 content to identify which might be duplicates or extra
  console.log('\nPaper 10 questions:');
  p10.forEach(q => {
    const preview = q.content?.substring(0, 80).replace(/\n/g, ' ').replace(/\$\$/g, '');
    console.log('  Q' + q.questionNumber + ' (' + q.content.length + '): ' + preview);
  });
  
  // The user said paper 10 has 15 questions. We have 17.
  // The 2 extra questions might be from numbered items like "1.样本" matching as Q1, 
  // or from sub-questions like "(1)证明" being split.
  // Let's check Q15-Q17 which are the essay questions (解答题)
  
  console.log('\n=== Q15-Q17 detail (解答题) ===');
  for (let i = 14; i < p10.length; i++) {
    console.log('\nQ' + p10[i].questionNumber + ' (' + p10[i].content.length + ' chars):');
    console.log(p10[i].content?.substring(0, 200));
  }
  
  // Check if Q14 contains "四、解答题" section header — if so, Q14 might be a fragment
  if (p10[13]) {
    console.log('\n=== Q14 check ===');
    console.log('Q14 contains "四、解答题":', p10[13].content?.includes('四、'));
    console.log('Q14 first 200:', p10[13].content?.substring(0, 200));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
