const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Show ALL lines that start with a number+period or contain "N." at line start
  const lines = md.split('\n');
  console.log('=== Lines starting with N. pattern ===');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(/^(\d{1,2})\.\s/);
    if (m) {
      console.log('Line ' + i + ': Q' + m[1] + ' => ' + line.substring(0, 100));
    }
  }
  
  // Also find ALL "N." patterns anywhere (not just line start)  
  console.log('\n=== ALL "N." occurrences (1-19) ===');
  for (let n = 1; n <= 19; n++) {
    const pattern = n + '. ';
    let idx = 0;
    let count = 0;
    while ((idx = md.indexOf(pattern, idx)) !== -1) {
      const before = md.substring(Math.max(0, idx-5), idx);
      const after = md.substring(idx + pattern.length, idx + pattern.length + 50);
      // Skip if inside LaTeX (preceded by $ { ^ _ or digit)
      if (!before.match(/[\d^_${]/) && !after.match(/^\d/)) {
        console.log('Q' + n + ' at idx=' + idx + ' before="' + before.replace(/\n/g,'\\n') + '" after="' + after.substring(0,40).replace(/\n/g,'\\n') + '"');
        count++;
        if (count >= 2) break;
      }
      idx += pattern.length;
    }
    if (count === 0) console.log('Q' + n + ': NOT FOUND');
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
