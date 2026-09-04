const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  console.log('Paper:', paper.id, paper.title, 'status:', paper.status);
  console.log('parsedMarkdown:', paper.parsedMarkdown?.length || 0, 'chars');
  console.log('editedMarkdown:', paper.editedMarkdown?.length || 0, 'chars');

  const questions = await prisma.question.findMany({ where: { paperId: paper.id }, orderBy: { questionNumber: 'asc' } });
  console.log('\nQuestions:', questions.length);
  questions.forEach(q => {
    console.log(`  Q${q.questionNumber}: content=${q.content?.length||0} ans=${q.answer?'Y':'N'} anal=${q.analysis?'Y':'N'}`);
  });
  
  // Check the editedMarkdown for tags
  const md = paper.editedMarkdown || paper.parsedMarkdown;
  if (md) {
    const startTags = (md.match(/<!--Q\d+_START-->/g) || []).length;
    const endTags = (md.match(/<!--Q\d+_END-->/g) || []).length;
    console.log('\nTags in markdown: START=' + startTags + ' END=' + endTags);
    
    // Check if Q5 tag exists
    const hasQ5 = md.includes('<!--Q5_START-->');
    console.log('Has Q5_START tag:', hasQ5);
  }
}

main().then(() => prisma.$disconnect());
