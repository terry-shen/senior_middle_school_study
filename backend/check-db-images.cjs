const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get paper #5 (latest import with images)
  const paper = await prisma.examPaper.findFirst({
    where: { id: 5 },
    select: { id: true, title: true, parsedMarkdown: true }
  });
  
  if (!paper) { console.log('Paper #5 not found'); return; }
  
  console.log('Paper:', paper.id, paper.title);
  console.log('parsedMarkdown length:', paper.parsedMarkdown ? paper.parsedMarkdown.length : 'null');
  
  if (paper.parsedMarkdown) {
    // Find image references
    const imgRefs = [...paper.parsedMarkdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
    console.log('\nImage references in parsedMarkdown:', imgRefs.length);
    imgRefs.forEach(m => console.log('  ', m[0]));
  }
  
  // Get questions for paper #5
  const questions = await prisma.question.findMany({
    where: { paperId: 5 },
    orderBy: { questionNumber: 'asc' },
    select: { id: true, questionNumber: true, content: true, answer: true, analysis: true, questionType: true }
  });
  
  console.log('\n\nQuestions:', questions.length);
  questions.forEach(q => {
    const hasImg = q.content && (q.content.includes('/uploads/') || q.content.includes('images/'));
    const hasImgUrl = q.content && q.content.includes('/uploads/papers/mineru-images/');
    console.log(`\nQ${q.questionNumber} (id=${q.id}, type=${q.questionType}):`);
    console.log('  content length:', q.content ? q.content.length : 0);
    console.log('  has image ref:', hasImg);
    console.log('  has /uploads/ URL:', hasImgUrl);
    if (hasImg) {
      // Show image refs
      const refs = [...q.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
      refs.forEach(r => console.log('    IMAGE REF:', r[0]));
    }
    console.log('  answer:', q.answer ? q.answer.substring(0, 80) : 'null');
    console.log('  analysis:', q.analysis ? q.analysis.substring(0, 80) : 'null');
  });
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
