const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.examPaper.findUnique({ where: { id: 11 }, select: { id: true, title: true, pdfUrl: true } });
  console.log('Paper 11:', JSON.stringify(p, null, 2));
  
  // List files in uploads/papers
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, 'uploads', 'papers');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
    console.log('\nPDF files in uploads/papers:');
    files.forEach(f => {
      const stat = fs.statSync(path.join(dir, f));
      console.log(`  ${f} (${Math.round(stat.size/1024)}KB)`);
    });
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
