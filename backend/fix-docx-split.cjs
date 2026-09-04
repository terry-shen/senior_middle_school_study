// Full E2E: restart backend, cleanup paper 10, split via API, verify
const { execSync, spawn } = require('child_process');
const http = require('http');
const { PrismaClient } = require('@prisma/client');

function postJSON(urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function getJSON(urlPath, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method: 'GET', path: urlPath, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const prisma = new PrismaClient();
  
  // Step 1: Cleanup paper 10 questions directly in DB
  console.log('1. Cleaning up paper 10 questions...');
  const del = await prisma.question.deleteMany({ where: { paperId: 10 } });
  console.log('   Deleted:', del.count);
  await prisma.examPaper.update({ where: { id: 10 }, data: { status: 'uploaded' } });
  console.log('   Paper 10 status reset');
  
  // Step 2: Check what splitQuestionsFromPaper does with paper 10
  const paper = await prisma.examPaper.findUnique({ where: { id: 10 } });
  console.log('\n2. Paper 10:');
  console.log('   parsedMarkdown length:', paper.parsedMarkdown?.length);
  console.log('   rawContent length:', paper.rawContent?.length);
  console.log('   parsedMarkdown === rawContent:', paper.parsedMarkdown === paper.rawContent);
  
  // Check for answer/analysis markers
  const ansCount = (paper.parsedMarkdown.match(/【答案/g) || []).length;
  const anaCount = (paper.parsedMarkdown.match(/【解析/g) || []).length;
  console.log('   【答案】markers:', ansCount, '【解析】markers:', anaCount);
  
  // Check for question numbers with full-width period
  const qNums = paper.parsedMarkdown.match(/\d{1,2}．/g) || [];
  console.log('   Question numbers (full-width ．):', qNums.length, qNums.slice(0, 10));
  
  await prisma.$disconnect();
  
  // Step 3: Login
  console.log('\n3. Logging in...');
  const loginResp = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  console.log('   Token obtained');
  
  // Step 4: Split via API
  console.log('\n4. Splitting paper 10 via API...');
  const splitResp = await postJSON('/api/papers/10/split', {}, { Authorization: 'Bearer ' + token });
  console.log('   HTTP:', splitResp.status);
  let splitData;
  try { splitData = JSON.parse(splitResp.data); } catch(e) { console.log('   Parse error:', splitResp.data.substring(0, 200)); return; }
  console.log('   success:', splitData.success);
  console.log('   questions:', splitData.questions?.length);
  
  if (splitData.questions) {
    splitData.questions.forEach((q, i) => {
      console.log('   Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length + ' ans=' + (q.answer?'Y':'N') + ' anal=' + (q.analysis?'Y':'N'));
    });
  }
  
  // Step 5: Verify in DB
  console.log('\n5. Verifying in DB...');
  const prisma2 = new PrismaClient();
  const dbQuestions = await prisma2.question.findMany({ where: { paperId: 10 }, orderBy: { questionNumber: 'asc' } });
  console.log('   Questions in DB:', dbQuestions.length);
  dbQuestions.forEach((q, i) => {
    console.log('   Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length + ' ans=' + (q.answer?'Y':'N') + ' anal=' + (q.analysis?'Y':'N'));
  });
  await prisma2.$disconnect();
  
  // Step 6: Check paper 9 for dedup comparison
  console.log('\n6. Paper 9 questions (for dedup):');
  const prisma3 = new PrismaClient();
  const paper9qs = await prisma3.question.findMany({ where: { paperId: 9 }, orderBy: { questionNumber: 'asc' }, select: { questionNumber: true, content: true } });
  console.log('   Paper 9 has', paper9qs.length, 'questions');
  paper9qs.forEach(q => console.log('   P9-Q' + q.questionNumber + ': ' + q.content?.substring(0, 50)));
  await prisma3.$disconnect();
}

main().catch(e => console.error('Error:', e.message, e.stack));
