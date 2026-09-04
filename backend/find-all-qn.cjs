const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const blocks = paper.parsedMarkdown.split('【答案');
  
  // Check each block for the next question number
  for (let i = 1; i <= 5 && i < blocks.length; i++) {
    const subParts = blocks[i].split('【解析');
    if (subParts.length < 2) continue;
    const ac = subParts.slice(1).join('【解析').replace(/^[】\s]*/, '');
    
    const nextNum = i + 1;
    const searchStr = nextNum + '.';
    let idx = ac.indexOf(searchStr);
    while (idx >= 0) {
      const before = ac.substring(Math.max(0, idx - 5), idx);
      const after = ac.substring(idx + searchStr.length, idx + searchStr.length + 30);
      // Check if it's followed by space or Chinese (not digit = not decimal)
      if (after.length > 0 && (after[0] === ' ' || after.charCodeAt(0) >= 0x4e00)) {
        console.log('Block ' + i + ' → Q' + nextNum + ' at idx=' + idx + ' before="' + before.replace(/\n/g, '\\n') + '" after="' + after.substring(0,20).replace(/\n/g, '\\n') + '"');
        break;
      }
      idx = ac.indexOf(searchStr, idx + 1);
    }
    if (idx < 0) console.log('Block ' + i + ' → Q' + nextNum + ' NOT FOUND');
  }
  
  // Also check blocks 6-18
  for (let i = 6; i < blocks.length; i++) {
    const subParts = blocks[i].split('【解析');
    if (subParts.length < 2) continue;
    const ac = subParts.slice(1).join('【解析').replace(/^[】\s]*/, '');
    
    const nextNum = i + 1;
    const searchStr = nextNum + '.';
    let idx = ac.indexOf(searchStr);
    while (idx >= 0) {
      const after = ac.substring(idx + searchStr.length, idx + searchStr.length + 10);
      if (after.length > 0 && (after[0] === ' ' || after.charCodeAt(0) >= 0x4e00)) {
        const before = ac.substring(Math.max(0, idx - 5), idx);
        console.log('Block ' + i + ' → Q' + nextNum + ' at idx=' + idx + ' before="' + before.replace(/\n/g,'\\n') + '"');
        break;
      }
      idx = ac.indexOf(searchStr, idx + 1);
    }
    if (idx < 0) console.log('Block ' + i + ' → Q' + nextNum + ' NOT FOUND');
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
