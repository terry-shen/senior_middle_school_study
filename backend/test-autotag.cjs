const { PrismaClient } = require('@prisma/client');
const { autoTagQuestions, splitQuestionsFromMarkdown, splitQuestionsByTags } = require('./dist/services/question-splitting-service');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  if (!paper) { console.log('No papers'); return; }
  console.log('Paper:', paper.id, '| parsedMarkdown:', paper.parsedMarkdown?.length || 0, '| editedMarkdown:', paper.editedMarkdown?.length || 0);

  const md = paper.parsedMarkdown || '';
  if (!md) { console.log('No parsedMarkdown'); return; }

  // Test autoTagQuestions
  const tagged = autoTagQuestions(md);
  const starts = (tagged.match(/<!--Q\d+_START-->/g) || []).length;
  const ends = (tagged.match(/<!--Q\d+_END-->/g) || []).length;
  console.log('autoTagQuestions: tagged length:', tagged.length, '| START tags:', starts, '| END tags:', ends);

  // If tags were generated, test splitQuestionsByTags
  if (starts > 0) {
    const result = splitQuestionsByTags(tagged);
    console.log('splitQuestionsByTags: questions:', result.questions?.length || 0);
    if (result.questions && result.questions.length > 0) {
      let withAns = 0, withAnal = 0;
      result.questions.forEach(q => {
        if (q.answer && q.answer.length > 0) withAns++;
        if (q.analysis && q.analysis.length > 0) withAnal++;
      });
      console.log('  withAnswer:', withAns, '| withAnalysis:', withAnal);
      console.log('  Q1 content[:80]:', result.questions[0].content?.substring(0, 80));
      console.log('  Q1 answer:', result.questions[0].answer);
    }
  } else {
    console.log('No tags generated! Checking splitQuestionsFromMarkdown...');
    const split = splitQuestionsFromMarkdown(md);
    console.log('splitQuestionsFromMarkdown: questions:', split.questions?.length || 0);
    if (split.questions && split.questions.length > 0) {
      console.log('  Q1 content[:80]:', split.questions[0].content?.substring(0, 80));
      console.log('  Q1 content length:', split.questions[0].content?.length);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
