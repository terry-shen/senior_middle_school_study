const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  console.log('parsedMarkdown length:', paper.parsedMarkdown?.length || 0);
  console.log('editedMarkdown length:', paper.editedMarkdown?.length || 0);
  
  const md = paper.parsedMarkdown;
  if (!md) { console.log('No parsedMarkdown'); return; }
  
  const { autoTagQuestions } = require('./dist/services/question-splitting-service');
  const tagged = autoTagQuestions(md);
  console.log('autoTagQuestions result length:', tagged?.length || 0);
  console.log('First 200 chars:', tagged?.substring(0, 200));
  
  const startTags = (tagged.match(/<!--Q\d+_START-->/g) || []).length;
  const endTags = (tagged.match(/<!--Q\d+_END-->/g) || []).length;
  console.log('Tags: START=' + startTags + ' END=' + endTags);
}

main().then(() => prisma.$disconnect());
