const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  // Check all remaining papers for their image prefix
  const papers = await prisma.examPaper.findMany({
    where: { sourceFormat: 'pdf', parsedMarkdown: { not: null } },
    select: { id: true, title: true, parsedMarkdown: true }
  });
  
  for (const paper of papers) {
    const md = paper.parsedMarkdown || '';
    // Extract image filename prefix
    const imgMatch = md.match(/mineru-images\/(paper-[^_]+)_/);
    const prefix = imgMatch ? imgMatch[1] : 'none';
    
    // Check if the image files are valid JPEG
    const imgDir = path.join(__dirname, 'uploads/papers/mineru-images');
    const firstFile = fs.readdirSync(imgDir).find(f => f.startsWith(prefix));
    let validJPEG = false;
    if (firstFile) {
      const buf = fs.readFileSync(path.join(imgDir, firstFile));
      validJPEG = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    
    if (!validJPEG) {
      console.log(`Paper #${paper.id}: ${paper.title} | prefix=${prefix} | CORRUPTED - deleting`);
      await prisma.question.deleteMany({ where: { paperId: paper.id } });
      await prisma.examPaper.delete({ where: { id: paper.id } });
      // Delete corrupt files
      const corruptFiles = fs.readdirSync(imgDir).filter(f => f.startsWith(prefix));
      corruptFiles.forEach(f => fs.unlinkSync(path.join(imgDir, f)));
      console.log(`  Deleted ${corruptFiles.length} corrupt files`);
    } else {
      console.log(`Paper #${paper.id}: ${paper.title} | prefix=${prefix} | VALID - keeping`);
    }
  }
  
  const remaining = await prisma.examPaper.findMany({
    where: { sourceFormat: 'pdf' },
    select: { id: true, title: true }
  });
  console.log('\nRemaining valid papers:', remaining.length);
  remaining.forEach(p => console.log(`  #${p.id}: ${p.title}`));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
