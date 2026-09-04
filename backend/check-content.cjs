const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all questions from paper #8 (the valid one with images)
  const questions = await prisma.question.findMany({
    where: { paperId: 8 },
    orderBy: { questionNumber: 'asc' },
    select: { id: true, questionNumber: true, content: true, answer: true, analysis: true }
  });
  
  console.log('=== Paper #8 Questions ===\n');
  questions.forEach((q, i) => {
    console.log(`--- Q${i+1} (id=${q.id}) ---`);
    console.log(`Content (${q.content.length} chars): ${q.content.substring(0, 200)}`);
    console.log(`Answer (${q.answer?.length || 0} chars): ${(q.answer || '').substring(0, 100)}`);
    console.log(`Analysis (${q.analysis?.length || 0} chars): ${(q.analysis || '').substring(0, 100)}`);
    console.log('');
  });
  
  // Also check the raw parsedMarkdown for completeness
  const paper = await prisma.examPaper.findUnique({
    where: { id: 8 },
    select: { parsedMarkdown: true }
  });
  if (paper && paper.parsedMarkdown) {
    console.log('=== ParsedMarkdown length:', paper.parsedMarkdown.length, '===\n');
    // Show first 1000 chars to see structure
    console.log('First 1000 chars of parsedMarkdown:');
    console.log(paper.parsedMarkdown.substring(0, 1000));
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
