const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Find ALL occurrences of standalone number+period patterns (1-19)
  // The pattern is: the number followed by a period, a space, and then non-digit content
  for (let n = 1; n <= 19; n++) {
    // Match: number, period, space, followed by content (not a digit = not a decimal)
    const pattern = new RegExp('(^|[^\\d.])(' + n + ')\\.\\s+(?=[^\\d])', 'g');
    const matches = [...md.matchAll(pattern)];
    if (matches.length > 0) {
      // Find the one that looks like a question start (not inside a formula)
      for (const m of matches) {
        const before = md.substring(Math.max(0, m.index + m[1].length - 20), m.index + m[1].length);
        const after = md.substring(m.index + m[1].length + m[2].length + 2, m.index + m[1].length + m[2].length + 80);
        // Skip if it's inside LaTeX ($...$) or looks like a decimal
        if (after.match(/^[a-zA-Z\u4e00-\u9fff[]/)) {  // starts with letter, Chinese, or bracket
          console.log('Q' + n + ': idx=' + (m.index + m[1].length) + ' before="' + before.replace(/\n/g,'\\n') + '" after="' + after.substring(0,60).replace(/\n/g,'\\n') + '"');
        }
      }
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
