const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const paper = await prisma.examPaper.findUnique({ where: { id: 9 } });
  const md = paper.parsedMarkdown;
  
  // Split by 【答案 markers into blocks
  // Block 0: everything before first 【答案 (Q1 content + options)
  // Block i: between 【答案】i and 【答案】i+1 (contains: answer, analysis, NEXT question content+options)
  
  const parts = md.split('【答案');
  console.log('Total blocks:', parts.length);
  
  // For block 0: it's Q1 content + options (no answer/analysis yet)
  // For block i (i>0): it starts with 】X\n\n【解析】[analysis]\n[next question content]\n[next options]
  // The NEXT question content is the text AFTER the analysis, up to the end of the block
  
  // So for question i:
  //   content = (text before first 【答案 for Q1) OR (text after analysis in block i-1 for Q>1)
  //   answer = text after 【答案 in block i, before 【解析
  //   analysis = text after 【解析 in block i, up to the start of next question content
  
  // The key insight: we need to find where analysis ends and next question begins.
  // We can use the A. B. C. D. options as a marker — the question content always has options
  // before the answer marker. So in block i-1, the text before the options is the question,
  // and the text between options and 【答案 is empty.
  
  // Actually, let's look at the raw structure differently:
  // Each "question block" = [question text] [options] 【答案】X 【解析】[analysis]
  // We can split the markdown into these blocks by finding 【答案 markers
  // and treating each as the END of a question block.
  
  // Q1 block = parts[0] (everything before first 【答案) — this is Q1 content + options
  // Q2 block = parts[1] split at 【解析 — answer part + analysis + Q2 content + options (for next)
  
  // Wait, that's not right either. Let me think again.
  // parts = md.split('【答案')
  // parts[0] = Q1 content + options (everything before first answer)
  // parts[1] = 】B\n\n【解析】[Q1 analysis]\n[Q2 content]\n[Q2 options]
  // parts[2] = 】C\n\n【解析】[Q2 analysis]\n[Q3 content]\n[Q3 options]
  // ...
  
  // So for question i:
  //   content = (i==0 ? parts[0] : part of parts[i] after 【解析】)
  //   answer = start of parts[i] (after 】)
  //   analysis = part of parts[i] between 【解析】 and the start of next question
  
  // The challenge: finding where analysis ends and next question begins in parts[i]
  // For parts[i], structure is: 】[answer]\n\n【解析】[analysis]\n[next question content]\n[next options]
  
  // Let's verify this by showing parts[0] and parts[1]:
  console.log('\n=== Parts[0] (Q1 content, length=' + parts[0].length + ') ===');
  console.log(parts[0].substring(0, 300).replace(/\n/g, '\\n'));
  
  console.log('\n=== Parts[1] (starts with Q1 answer, length=' + parts[1].length + ') ===');
  console.log(parts[1].substring(0, 500).replace(/\n/g, '\\n'));
  
  // Now I can see: parts[1] = 】B\n\n【解析】[Q1 analysis text]\n\n[Q2 question text]\n[Q2 options]
  // To find where analysis ends and Q2 begins, I need to split parts[1] at 【解析
  // and then find the boundary in the analysis text.
  
  // Let's check parts[1] split at 【解析:
  const subParts = parts[1].split('【解析');
  console.log('\n=== Parts[1] sub-parts ===');
  console.log('subParts[0] (answer):', subParts[0].substring(0, 50).replace(/\n/g, '\\n'));
  console.log('subParts[1] (analysis+Q2 content):', subParts[1].substring(0, 300).replace(/\n/g, '\\n'));
  
  // The analysis text runs until the next question content starts.
  // The next question content might start with a number "2." or just Chinese text.
  // But we can't reliably detect this boundary.
  
  // HOWEVER: for display purposes, we can assign:
  //   Q1 content = parts[0] (clean: just question + options, no analysis)
  //   Q1 answer = first line of parts[1] (before 【解析)
  //   Q1 analysis = parts[1] after 【解析 (includes Q2 content, but that's the best we can do)
  //   Q2 content = parts[1] after 【解析 (same as Q1 analysis — overlap!)
  
  // This overlap is the fundamental problem. The MinerU output doesn't have clean
  // boundaries between analysis and next question.
  
  // BEST SOLUTION: Assign each question just the content before 【答案,
  // and accept that content may include previous analysis text.
  // Then run LLM cleanup to separate them.
  
  // OR: Split parts[1] at 【解析, and assign:
  //   Q1 answer = before 【解析
  //   Q1 analysis = after 【解析 (FULL text including next Q content)
  //   Q2 content = parts[1] after 【解析 (SAME as Q1 analysis)
  // This means Q2 content == Q1 analysis, which is wrong for display.
  
  // ACTUAL BEST: Use the answer marker as the ONLY split point.
  //   Block 0 (before first 【答案) = Q1 content
  //   Block 1 (between ans[0] and ans[1]) = Q1 answer + Q1 analysis + Q2 content
  //   Extract Q1 answer = first part of block 1 (before 【解析)
  //   Extract Q1 analysis = after 【解析 (but we STOP at the point where Q2 content starts)
  //   Q2 content = the remainder after Q1 analysis
  
  // The problem remains: where does Q1 analysis end and Q2 content begin?
  // Without question numbers, we CAN'T tell.
  
  // CONCLUSION: With MinerU's current output format, we can only cleanly extract:
  //   1. Q1 content (before first 【答案) — clean
  //   2. Each answer (between 【答案 and 【解析) — clean
  //   3. Each analysis (between 【解析 and next 【答案) — INCLUDES next Q content
  
  // For Q2-Q18 content, it's embedded in the previous Q's analysis text.
  // We need either:
  //   a) Question numbers in the markdown (only 6 of 18 have them)
  //   b) LLM to separate analysis from next question
  //   c) Accept the overlap and let MathText render it
  
  console.log('\n=== Conclusion ===');
  console.log('Q1 content (clean):', parts[0].length, 'chars');
  console.log('Parts count:', parts.length);
  console.log('Expected 19 questions but only', parts.length - 1, 'answer markers found');
}
main().then(() => prisma.$disconnect()).catch(e => console.error(e));
