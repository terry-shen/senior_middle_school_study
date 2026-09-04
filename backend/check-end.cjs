const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  // Show content after last 【答案】 marker
  const lastAns = md.lastIndexOf('【答案');
  const remaining = md.substring(lastAns);
  console.log('Content after last 【答案】 (' + remaining.length + ' chars):');
  console.log(remaining.substring(0, 500));
  
  // Also check: the markdown starts with a header "一、单项选择题"
  // There might be section headers that indicate question groups
  const sections = [...md.matchAll(/([一二三四五六七八九十]+)、([^\n]+)/g)];
  console.log('\nSections found:');
  sections.forEach(s => console.log('  ' + s[1] + '、' + s[2].substring(0, 60)));
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
