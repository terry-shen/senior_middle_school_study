const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({
    where: { id: 8 },
    select: { parsedMarkdown: true }
  });
  const md = paper.parsedMarkdown;
  
  // Find Q2 (已知集合) in markdown to see full content
  const q2Start = md.indexOf('已知集合');
  if (q2Start >= 0) {
    console.log('=== Q2 area in parsedMarkdown (500 chars) ===');
    console.log(md.substring(q2Start, q2Start + 500));
  }
  
  console.log('\n\n=== Q5 area ===');
  const q5Start = md.indexOf('已知 为第二象限角');
  if (q5Start >= 0) {
    console.log(md.substring(q5Start, q5Start + 500));
  }
  
  console.log('\n\n=== Q9 area ===');
  const q9Start = md.indexOf('已知抛物线');
  if (q9Start >= 0) {
    console.log(md.substring(q9Start, q9Start + 600));
  }
  
  console.log('\n\n=== Q1 area (向量) ===');
  const q1Start = md.indexOf('已知向量');
  if (q1Start >= 0) {
    console.log(md.substring(q1Start, q1Start + 400));
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
