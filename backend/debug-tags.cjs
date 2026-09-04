const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get paper #21's parsedMarkdown
  const paper = await prisma.examPaper.findFirst({ orderBy: { id: 'desc' } });
  if (!paper) { console.log('No paper found'); return; }
  
  console.log('Paper ID:', paper.id, 'Title:', paper.title);
  console.log('parsedMarkdown length:', paper.parsedMarkdown?.length || 0);
  console.log('editedMarkdown length:', paper.editedMarkdown?.length || 0);
  
  const md = paper.editedMarkdown || paper.parsedMarkdown;
  if (!md) { console.log('No markdown'); return; }
  
  // Import the service functions
  const { autoTagQuestions, splitQuestionsByTags } = require('./dist/services/question-splitting-service');
  
  // 1. Auto-tag the markdown
  console.log('\n=== autoTagQuestions ===');
  const tagged = autoTagQuestions(md);
  console.log('Tagged length:', tagged.length, '(original:', md.length, ')');
  
  // Count tags
  const startTags = (tagged.match(/<!--Q\d+_START-->/g) || []).length;
  const endTags = (tagged.match(/<!--Q\d+_END-->/g) || []).length;
  console.log('START tags:', startTags, 'END tags:', endTags);
  
  // Show tag positions
  const tagPositions = [];
  let pos = 0;
  while ((pos = tagged.indexOf('<!--Q', pos)) !== -1) {
    const end = tagged.indexOf('-->', pos);
    const tagText = tagged.substring(pos, end + 3);
    const afterTag = tagged.substring(end + 3, end + 53).replace(/\n/g, ' ');
    tagPositions.push({ pos, tag: tagText, after: afterTag });
    pos = end + 3;
  }
  console.log('\nTag positions (first 10):');
  tagPositions.slice(0, 10).forEach(t => console.log(`  [${t.pos}] ${t.tag} → ${t.after.substring(0, 40)}...`));
  
  // 2. Split by tags
  console.log('\n=== splitQuestionsByTags ===');
  const result = splitQuestionsByTags(tagged);
  console.log('Questions:', result.questions?.length || 0);
  
  if (result.questions) {
    result.questions.forEach(q => {
      const hasAns = q.correctAnswer ? 'Y' : 'N';
      const hasAnal = q.analysis ? 'Y' : 'N';
      console.log(`  Q${q.questionNumber}: content=${q.content?.length||0} ans=${hasAns} anal=${hasAnal}`);
    });
  }
  
  // 3. Show first 2 tag pairs content
  const tagRegex = /<!--Q(\d+)_START-->([\s\S]*?)<!--Q\1_END-->/g;
  let match;
  let count = 0;
  console.log('\n=== First 3 tag pair contents ===');
  while ((match = tagRegex.exec(tagged)) !== null && count < 3) {
    count++;
    const qNum = match[1];
    const content = match[2].trim();
    console.log(`\nQ${qNum} (content length: ${content.length}):`);
    console.log(content.substring(0, 200));
    console.log('---');
  }
  
  // 4. Check if tags are properly paired (each START followed by matching END before next START)
  console.log('\n=== Tag pairing check ===');
  const allTags = [];
  const tagScanRegex = /<!--Q(\d+)_(START|END)-->/g;
  let m2;
  while ((m2 = tagScanRegex.exec(tagged)) !== null) {
    allTags.push({ num: parseInt(m2[1]), type: m2[2], pos: m2.index });
  }
  console.log('All tags in order:');
  allTags.forEach(t => console.log(`  [${t.pos}] Q${t.num}_${t.type}`));
  
  // Check pairing
  let pairingOk = true;
  for (let i = 0; i < allTags.length; i++) {
    if (allTags[i].type === 'START') {
      // Next tag should be matching END
      if (i + 1 >= allTags.length || allTags[i+1].type !== 'END' || allTags[i+1].num !== allTags[i].num) {
        console.log(`  ❌ Q${allTags[i].num} START at ${allTags[i].pos} — next tag is NOT matching END`);
        pairingOk = false;
      }
    }
  }
  if (pairingOk) console.log('  ✅ All tags properly paired');
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
