const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  // Find ALL occurrences of N. patterns (1-19)
  for (let n = 1; n <= 19; n++) {
    const pattern = new RegExp('(^|\\n|。|）|\\)|\\s)\\s*' + n + '\\.\\s', 'g');
    const matches = [...md.matchAll(pattern)];
    if (matches.length > 0) {
      const m = matches[0];
      const ctx = md.substring(Math.max(0, m.index - 10), m.index + 60);
      console.log('Q' + n + ': found at idx=' + m.index + ' context: ' + JSON.stringify(ctx));
    } else {
      console.log('Q' + n + ': NOT FOUND');
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
