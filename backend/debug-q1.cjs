const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  const blocks = md.split('【答案');
  
  // Show block 0 processing
  let q1Content = blocks[0]
    .replace(/^#[^#]*\n/g, '')
    .replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '')
    .replace(/^\s*\d{1,2}\.\s*/, '')
    .trim();
  
  console.log('Block 0 raw length:', blocks[0].length);
  console.log('Q1 content length:', q1Content.length);
  console.log('Q1 content:', q1Content.substring(0, 200));
  
  // Also check: block 1 should contain Q2 content
  const block1 = blocks[1];
  const subParts = block1.split('【解析');
  console.log('\nBlock 1 answer part:', subParts[0].substring(0, 30));
  
  // In subParts[1], find "2." pattern
  const analysisAndContent = subParts[1] ? subParts[1].replace(/^[】\s]*/, '') : '';
  console.log('Analysis+Q2 content (first 200):', analysisAndContent.substring(0, 200).replace(/\n/g, '\\n'));
  
  // Find "2." in analysisAndContent
  const match = analysisAndContent.match(/(^|[\n。\s])(2)\.\s/);
  if (match) {
    console.log('\nFound "2." at index:', match.index);
    const splitIdx = match.index + match[1].length;
    console.log('Analysis:', analysisAndContent.substring(0, splitIdx).trim().substring(0, 80));
    console.log('Q2 content:', analysisAndContent.substring(splitIdx + 3).trim().substring(0, 80));
  } else {
    console.log('\n"2." NOT FOUND in analysis text');
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
