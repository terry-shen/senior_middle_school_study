const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  // Find old papers with corrupted images
  const papers = await prisma.examPaper.findMany({
    where: { sourceFormat: 'pdf' },
    select: { id: true, title: true, parsedMarkdown: true, pageImages: true }
  });
  
  for (const paper of papers) {
    if (!paper.parsedMarkdown) continue;
    // Check if it has old corrupted image refs (paper-1788228 prefix)
    if (paper.parsedMarkdown.includes('paper-1788228551822')) {
      console.log(`Paper #${paper.id}: ${paper.title} - has OLD corrupted images`);
      // Delete questions for this paper
      const deleted = await prisma.question.deleteMany({ where: { paperId: paper.id } });
      console.log(`  Deleted ${deleted.count} questions`);
      // Delete the paper
      await prisma.examPaper.delete({ where: { id: paper.id } });
      console.log(`  Deleted paper #${paper.id}`);
    } else if (paper.parsedMarkdown.includes('paper-1788252424333') || paper.parsedMarkdown.includes('paper-1788246199618')) {
      console.log(`Paper #${paper.id}: ${paper.title} - has NEW valid images (keeping)`);
    }
  }
  
  // Delete old corrupted image files from disk
  const imgDir = path.join(__dirname, 'uploads/papers/mineru-images');
  if (fs.existsSync(imgDir)) {
    const oldFiles = fs.readdirSync(imgDir).filter(f => f.startsWith('paper-1788228551822') || f.startsWith('paper-1788246199618'));
    let deleted = 0;
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(imgDir, f));
      deleted++;
    }
    console.log(`\nDeleted ${deleted} corrupted image files from disk`);
  }
  
  // Verify remaining images
  const remaining = await prisma.examPaper.findMany({
    where: { sourceFormat: 'pdf' },
    select: { id: true, title: true }
  });
  console.log('\nRemaining papers:', remaining.length);
  remaining.forEach(p => console.log(`  #${p.id}: ${p.title}`));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
