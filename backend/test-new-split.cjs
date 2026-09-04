const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Inline the new split logic for testing
function splitNew(markdown) {
  const ansMarker = '【答案';
  const anaMarker = '【解析';
  const blocks = markdown.split(ansMarker);
  
  if (blocks.length <= 1) return { success: false, questions: [] };
  
  const questions = [];
  
  // Block 0 = Q1 content
  let q1Content = blocks[0]
    .replace(/^#[^#]*\n/g, '')
    .replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '')
    .replace(/^\s*\d{1,2}\.\s*/, '')
    .trim();
  
  if (q1Content.length >= 3) {
    questions.push({ questionNumber: 1, content: q1Content, correctAnswer: null, analysis: null });
  }
  
  // Process blocks 1 to N
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const subParts = block.split(anaMarker);
    const answerPart = subParts[0].replace(/^[】\s]*/, '').trim();
    const analysisAndContent = subParts.length > 1 ? subParts.slice(1).join(anaMarker).replace(/^[】\s]*/, '') : '';
    
    // Set answer on question i
    const q = questions.find(q => q.questionNumber === i);
    if (q) { q.correctAnswer = answerPart; } 
    else {
      // Question i doesn't exist yet — create it with empty content
      questions.push({ questionNumber: i, content: '', correctAnswer: answerPart, analysis: null });
    }
    
    // Find next question number in analysis text
    const nextQNum = i + 1;
    const qNumPattern = new RegExp('(^|[\\n。\\s])(' + nextQNum + ')\\.\\s');
    const qNumMatch = qNumPattern.exec(analysisAndContent);
    
    let analysis, nextQContent;
    if (qNumMatch && qNumMatch.index >= 0) {
      const splitIdx = qNumMatch.index + qNumMatch[1].length;
      analysis = analysisAndContent.substring(0, splitIdx).trim();
      nextQContent = analysisAndContent.substring(splitIdx + qNumMatch[2].length + 2).trim();
    } else {
      analysis = analysisAndContent.trim();
      nextQContent = null;
    }
    
    // Set analysis on question i
    const qi = questions.find(q => q.questionNumber === i);
    if (qi) { qi.analysis = analysis; }
    
    // Add next question content
    if (nextQContent && nextQContent.length >= 3) {
      nextQContent = nextQContent
        .replace(/^#[^#]*\n/g, '')
        .replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '')
        .replace(/^\s*\d{1,2}\.\s*/, '')
        .trim();
      
      if (nextQContent.length >= 3) {
        // Don't add if question with this number already exists
        const existing = questions.find(q => q.questionNumber === i + 1);
        if (!existing) {
          questions.push({ questionNumber: i + 1, content: nextQContent, correctAnswer: null, analysis: null });
        } else {
          existing.content = nextQContent;
        }
      }
    }
  }
  
  // Sort by question number
  questions.sort((a, b) => a.questionNumber - b.questionNumber);
  
  return { success: true, questions };
}

async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const result = splitNew(paper.parsedMarkdown);
  console.log('Questions:', result.questions.length);
  result.questions.forEach(q => {
    console.log('Q' + q.questionNumber + ': content=' + q.content?.length + ' ans=' + (q.correctAnswer||'none').substring(0,20) + ' anal=' + q.analysis?.length);
    if (q.content) console.log('  content: ' + q.content.substring(0, 100).replace(/\n/g, '\\n'));
  });
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
