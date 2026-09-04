const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 6 }, select: { rawContent: true } });
  const rc = paper.rawContent || '';
  
  // Simulate the split logic for ONE question
  // Find first question boundary
  const matches = [...rc.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s*(?![\d.])/g)];
  console.log('Question matches:', matches.length);
  
  if (matches.length >= 2) {
    // Get raw content for Q2 (between match[0] and match[1])
    const start = matches[1].index;
    const end = matches.length > 2 ? matches[2].index : rc.length;
    let rawContent = rc.substring(start, end);
    console.log('\nQ2 rawContent length:', rawContent.length);
    console.log('Q2 rawContent preview:', rawContent.substring(0, 200));
    
    // Strip question number
    rawContent = rawContent.replace(/^\s*\d{1,2}\.\s*/, '');
    
    const ansIdx = rawContent.indexOf('【答案');
    const anaIdx = rawContent.indexOf('【解析');
    console.log('\nansIdx:', ansIdx, 'anaIdx:', anaIdx);
    
    if (ansIdx >= 0 && anaIdx >= 0 && anaIdx > ansIdx) {
      const content = rawContent.substring(0, ansIdx).trim();
      const ansRaw = rawContent.substring(ansIdx, anaIdx);
      const correctAnswer = ansRaw.replace(/^【答案[】\s]*/, '').trim();
      const analysis = rawContent.substring(anaIdx).replace(/^【解析[】\s]*/, '').trim();
      console.log('\ncontent length:', content.length);
      console.log('correctAnswer:', correctAnswer);
      console.log('analysis length:', analysis.length);
      console.log('analysis preview:', analysis.substring(0, 100));
    } else {
      console.log('Condition not met: ansIdx >= 0:', ansIdx >= 0, '&& anaIdx >= 0:', anaIdx >= 0, '&& anaIdx > ansIdx:', anaIdx > ansIdx);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
