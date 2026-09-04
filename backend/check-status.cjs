const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const c1 = await p.question.count({ where: { paperId: 6 } });
  console.log('Questions for paper 6:', c1);
  const c2 = await p.question.count();
  console.log('Total questions:', c2);
  const paper = await p.examPaper.findUnique({ where: { id: 6 }, select: { id: true, status: true, title: true, parsedMarkdown: true } });
  console.log('Paper 6:', paper?.id, paper?.status, paper?.title, 'mdLen=' + (paper?.parsedMarkdown?.length || 0));
}
main().then(() => p.$disconnect()).catch(e => console.error(e));
