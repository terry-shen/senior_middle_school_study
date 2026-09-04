const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  const md = paper.parsedMarkdown;
  
  // Find all occurrences of "5." in the markdown
  let pos = 0;
  while ((pos = md.indexOf('5.', pos)) !== -1) {
    const before = md.substring(Math.max(0, pos - 20), pos).replace(/\n/g, '\\n');
    const after = md.substring(pos, pos + 30).replace(/\n/g, '\\n');
    console.log(`pos=${pos}: ...${before}[5.]${after}...`);
    pos++;
  }
  
  // Check line start of "5."
  const lines = md.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(\d{1,2})[．.]\s/);
    if (m) console.log(`Line ${i}: "${line.substring(0, 50)}" → Q${m[1]}`);
  });
}

main().then(() => prisma.$disconnect());
