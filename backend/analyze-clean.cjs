const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Find all 【答案 and 【解析 positions
  const ansPos = [];
  let p = 0;
  while ((p = md.indexOf('【答案', p)) !== -1) { ansPos.push(p); p += 4; }
  
  const anaPos = [];
  p = 0;
  while ((p = md.indexOf('【解析', p)) !== -1) { anaPos.push(p); p += 4; }
  
  console.log('Answers:', ansPos.length, 'Analysis:', anaPos.length);
  
  // The structure is:
  // Q1: [content] [options] 【答案】X 【解析】[analysis]
  // Q2: [content] [options] 【答案】X 【解析】[analysis]
  // ...
  //
  // For question i:
  //   content = text between (end of previous analysis) and (this answer marker)
  //   answer = text between (answer marker) and (analysis marker)  
  //   analysis = text between (analysis marker) and (start of next question content)
  //             BUT the next question content starts somewhere before the next answer marker
  
  // The tricky part: analysis goes until where the next question starts.
  // The next question starts at the text that comes BEFORE the next 【答案】 marker.
  // But we don't know exactly where the analysis ends and the next question begins.
  // 
  // Heuristic: The analysis is typically short text. The next question starts with
  // either a number ("N.") or recognizable question content.
  // For now: analysis goes from 【解析】 to the next 【答案】 marker.
  // The content for the next question starts right after 【解析】... text.
  // But we can't cleanly separate analysis text from next question text.
  //
  // BETTER APPROACH: content for Q(i) is between end of Q(i-1)'s analysis marker
  //   and Q(i)'s answer marker. This INCLUDES the previous analysis text, which is wrong.
  //
  // BEST APPROACH: Use both markers as boundaries:
  //   - Question content = everything from start of markdown to first 【答案】 (for Q1)
  //   - For Q(i>1): content = text between the END of Q(i-1)'s answer and this 【答案】
  //     BUT this includes Q(i-1)'s 【解析】 text
  //   
  // Actually, the cleanest split is:
  //   Block i = [content] [options] 【答案】X 【解析】[analysis]
  //   Block boundary = at each 【答案】 marker
  //   So Q1 = text before ansPos[0]
  //   Q2 = text between end of ansPos[0]'s answer+analysis and ansPos[1]
  //   etc.
  //
  // For each answer i, find the matching analysis:
  
  for (let i = 0; i < ansPos.length; i++) {
    const aStart = ansPos[i];
    // Find matching analysis (first 【解析 after this answer, before next answer)
    let aEnd = -1;
    for (let j = 0; j < anaPos.length; j++) {
      if (anaPos[j] > aStart && (i + 1 >= ansPos.length || anaPos[j] < ansPos[i + 1])) {
        aEnd = anaPos[j];
        break;
      }
    }
    
    // Q content: from end of previous block to this answer
    let contentStart = 0;
    if (i > 0) {
      // Previous block: previous answer + previous analysis
      // The previous analysis starts at anaPos matching previous answer
      let prevAnaEnd = -1;
      for (let j = 0; j < anaPos.length; j++) {
        if (anaPos[j] > ansPos[i-1] && anaPos[j] < aStart) {
          prevAnaEnd = anaPos[j];
          break;
        }
      }
      if (prevAnaEnd >= 0) {
        contentStart = prevAnaEnd; // Start from previous 【解析 marker
      } else {
        contentStart = ansPos[i-1]; // Start from previous answer
      }
    }
    
    // Content is from contentStart to aStart, but we need to strip the previous analysis text
    let rawContent = md.substring(contentStart, aStart);
    
    // Strip 【解析】... prefix if present (from previous block's analysis)
    if (i > 0 && rawContent.startsWith('【解析')) {
      // Find where the analysis text ends and the actual question begins
      // The analysis text typically ends with a period or newline before the question content
      // Look for the start of actual question content
      // Heuristic: find the first line that looks like a question (starts with number, or Chinese text after options)
      
      // For now, just strip the marker
      rawContent = rawContent.replace(/^【解析[】\s]*/, '');
      
      // Now the content has: [prev analysis text] [this question content] [options]
      // We can't cleanly separate them without knowing where the analysis ends.
      // BUT: we can look for the question number if it exists, or look for A. B. C. D. options
      // which indicate the question part.
      
      // Find where the options start (A. B. C. D.)
      const optMatch = rawContent.match(/\nA\.\s|\nA\s/m);
      if (optMatch) {
        // Content before options is the question text
        // But we need to find where the actual question starts (after the prev analysis)
        // The prev analysis typically ends with a period (。or .)
        // and the new question starts with a number or known text
        
        // Simple heuristic: if there's a number "N." in the content, split there
        const numMatch = rawContent.match(/(\d{1,2})\.\s/g);
        if (numMatch) {
          // Find the LAST number match before the options — that's the question number
          let lastNumIdx = -1;
          let searchStr = rawContent;
          for (const nm of numMatch) {
            const idx = searchStr.lastIndexOf(nm);
            if (idx > lastNumIdx) lastNumIdx = idx;
          }
          if (lastNumIdx >= 0) {
            rawContent = rawContent.substring(lastNumIdx);
            rawContent = rawContent.replace(/^\d{1,2}\.\s/, ''); // Remove the number prefix
          }
        }
      }
    }
    
    // Strip section headers
    rawContent = rawContent.replace(/^#[^#]*\n/g, '').replace(/^[一二三四五六七八九十]+、[^\n]*\n/g, '').trim();
    rawContent = rawContent.replace(/^\s*\d{1,2}\.\s*/, '').trim(); // Remove leading "N. "
    
    // Extract answer
    let answer = '';
    if (aEnd > aStart) {
      answer = md.substring(aStart, aEnd).replace(/^【答案[】\s]*/, '').trim();
    }
    
    // Extract analysis  
    let analysis = '';
    if (aEnd > 0) {
      const nextStart = i + 1 < ansPos.length ? ansPos[i + 1] : md.length;
      analysis = md.substring(aEnd, nextStart).replace(/^【解析[】\s]*/, '').trim();
    }
    
    // Show result
    console.log('\nQ' + (i+1) + ': content=' + rawContent.length + ' ans=' + answer.length + ' anal=' + analysis.length);
    console.log('  content: ' + rawContent.substring(0, 80).replace(/\n/g, '\\n'));
    console.log('  answer: ' + answer.substring(0, 30));
    console.log('  analysis: ' + analysis.substring(0, 50).replace(/\n/g, '\\n'));
  }
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
