const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  // Show content from Q1 to Q7 to understand the structure
  // Q1 at idx=54, Q7 at idx=4194
  const segment = md.substring(54, 4200);
  // Show just the 【答案】 and 【解析】 markers and what's between them
  const lines = segment.split('\n');
  let qCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d{1,2}\.\s/)) { qCount++; console.log('\n--- Q' + qCount + ' (line ' + i + '): ' + line.substring(0, 80)); }
    else if (line.includes('【答案】')) console.log('  ANSWER: ' + line.substring(0, 80));
    else if (line.includes('【解析】')) console.log('  ANALYSIS: ' + line.substring(0, 80));
    else if (line.match(/^A\.\s/) || line.match(/^B\.\s/) || line.match(/^C\.\s/) || line.match(/^D\.\s/)) console.log('  OPTION: ' + line.substring(0, 80));
  }
  
  // Also check for question numbers NOT at line start
  console.log('\n=== Searching for inline question numbers ===');
  for (let n = 1; n <= 19; n++) {
    // Search for "N." with any preceding char (not digit/dot)
    const pattern = new RegExp('([^\\d.^${}_])' + n + '\\.\\s', 'g');
    const matches = [...md.matchAll(pattern)];
    if (matches.length > 0 && n <= 19) {
      // Filter to ones where the following text looks like a question
      for (const m of matches) {
        const after = md.substring(m.index + 2, m.index + 60);
        if (after.match(/^[\u4e00-\u9fffA-Z$a-zA-Z]/) && !after.match(/^\d/)) {
          const before = md.substring(Math.max(0, m.index - 10), m.index + 1);
          console.log('Q' + n + ': before="' + before.replace(/\n/g,'\\n') + '" after="' + after.substring(0,50).replace(/\n/g,'\\n') + '"');
        }
      }
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
