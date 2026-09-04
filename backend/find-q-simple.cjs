const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Search for each number 1-19 followed by period and space
  for (let n = 1; n <= 19; n++) {
    // Simple search: find "N." followed by space and Chinese/text
    const patterns = [
      n + '. ',  // "1. "
      n + '.\u00a0',  // non-breaking space
    ];
    let found = false;
    for (const p of patterns) {
      let idx = 0;
      while ((idx = md.indexOf(p, idx)) !== -1) {
        const before = md.substring(Math.max(0, idx - 15), idx);
        const after = md.substring(idx + p.length, idx + p.length + 60);
        // Skip if inside LaTeX (preceded by $ or {)
        if (before.endsWith('$') || before.endsWith('{') || before.endsWith('^') || before.endsWith('_')) {
          idx += p.length;
          continue;
        }
        // Skip if it's a decimal (preceded by digit)
        if (idx > 0 && /\d/.test(md[idx-1])) {
          idx += p.length;
          continue;
        }
        // This looks like a question number
        console.log('Q' + n + ': idx=' + idx + ' before="' + before.replace(/\n/g,'\\n') + '" after="' + after.substring(0,50).replace(/\n/g,'\\n') + '"');
        found = true;
        break;
      }
      if (found) break;
    }
    if (!found) console.log('Q' + n + ': NOT FOUND');
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
