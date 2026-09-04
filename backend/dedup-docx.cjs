const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Get all paper 10 questions
  const qs = await prisma.question.findMany({ where: { paperId: 10 }, orderBy: { id: 'asc' } });
  console.log('Total questions:', qs.length);
  
  // Find duplicate question numbers and keep only the first occurrence
  const seen = new Set();
  const toDelete = [];
  for (const q of qs) {
    if (seen.has(q.questionNumber)) {
      toDelete.push(q.id);
    } else {
      seen.add(q.questionNumber);
    }
  }
  console.log('Duplicate IDs to delete:', toDelete);
  
  if (toDelete.length > 0) {
    const del = await prisma.question.deleteMany({ where: { id: { in: toDelete } } });
    console.log('Deleted:', del.count, 'duplicates');
  }
  
  // Renumber remaining questions sequentially
  const remaining = await prisma.question.findMany({ where: { paperId: 10 }, orderBy: { id: 'asc' } });
  console.log('Remaining questions:', remaining.length);
  
  for (let i = 0; i < remaining.length; i++) {
    await prisma.question.update({ where: { id: remaining[i].id }, data: { questionNumber: i + 1 } });
  }
  console.log('Renumbered sequentially');
  
  // Show final state
  const final = await prisma.question.findMany({ where: { paperId: 10 }, orderBy: { questionNumber: 'asc' } });
  console.log('\nFinal paper 10 questions:');
  final.forEach(q => console.log('  Q' + q.questionNumber + ': content=' + q.content?.length + ' | ' + q.content?.substring(0, 60).replace(/\n/g, ' ')));
  
  // Also show paper 9 final state
  const p9 = await prisma.question.findMany({ where: { paperId: 9 }, orderBy: { questionNumber: 'asc' } });
  console.log('\nPaper 9 questions (' + p9.length + '):');
  p9.forEach(q => console.log('  Q' + q.questionNumber + ': content=' + q.content?.length + ' | ' + q.content?.substring(0, 60).replace(/\n/g, ' ')));
  
  console.log('\n=== Summary ===');
  console.log('Paper 9 (PDF):', p9.length, 'questions');
  console.log('Paper 10 (DOCX):', final.length, 'questions');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
