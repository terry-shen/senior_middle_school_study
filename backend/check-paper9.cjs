const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  if (!paper || !paper.parsedMarkdown) { console.log('No parsedMarkdown'); return; }
  
  const md = paper.parsedMarkdown;
  console.log('parsedMarkdown length:', md.length);
  
  // Count all number patterns like "1." "2." etc at start of lines
  const matches = [...md.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s/g)];
  console.log('Total question number matches:', matches.length);
  console.log('Numbers found:', matches.map(m => m[1]).join(', '));
  
  // Count 【答案】 markers
  const ansMatches = [...md.matchAll(/【答案】/g)];
  console.log('【答案】 markers:', ansMatches.length);
  
  // Count 【解析】 markers  
  const analMatches = [...md.matchAll(/【解析】/g)];
  console.log('【解析】 markers:', analMatches.length);
  
  // Show context around question 18, 19 if they exist
  const q18 = md.indexOf('18.');
  const q19 = md.indexOf('19.');
  console.log('\nIndex of "18.":', q18);
  console.log('Index of "19.":', q19);
  
  if (q18 > 0) console.log('\nContext around 18:', md.substring(q18-20, q18+200));
  if (q19 > 0) console.log('\nContext around 19:', md.substring(q19-20, q19+200));
  
  // Show first 500 chars to understand format
  console.log('\n=== First 500 chars ===');
  console.log(md.substring(0, 500));
  
  // Show last 500 chars
  console.log('\n=== Last 500 chars ===');
  console.log(md.substring(md.length - 500));
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
