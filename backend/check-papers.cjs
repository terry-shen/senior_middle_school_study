const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const papers = await prisma.examPaper.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    select: { id: true, title: true, sourceFormat: true, status: true, parsedMarkdown: true, rawContent: true, createdAt: true },
  });
  console.log('=== Recent Papers ===');
  for (const p of papers) {
    console.log(`ID=${p.id} | title="${p.title}" | fmt=${p.sourceFormat} | status=${p.status} | md=${p.parsedMarkdown ? p.parsedMarkdown.length + ' chars' : 'null'} | raw=${p.rawContent ? p.rawContent.length + ' chars' : 'null'} | ${p.createdAt.toISOString()}`);
    const qCount = await prisma.question.count({ where: { paperId: p.id } });
    console.log(`  -> ${qCount} questions in DB`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
