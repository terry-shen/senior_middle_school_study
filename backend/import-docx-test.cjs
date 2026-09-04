const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function postForm(urlPath, formData, headers) {
  return new Promise((resolve, reject) => {
    const formHeaders = formData.getHeaders();
    const opts = { host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { ...formHeaders, ...headers } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    formData.pipe(req);
  });
}

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

async function main() {
  // Login
  const loginResp = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  console.log('1. Login: OK');

  // Import DOCX
  const docxPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国卷l数学卷高考真题带答案带解析文字版.docx';
  console.log('2. Importing DOCX (MinerU parsing)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(docxPath), { filename: '2026_math_vol1.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  form.append('title', '2026年全国卷I数学卷');
  const importResp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  console.log('   HTTP:', importResp.status);
  const importData = JSON.parse(importResp.data);
  console.log('   success:', importData.success);
  console.log('   paperId:', importData.paper?.id);
  console.log('   parserUsed:', importData.parserUsed);
  console.log('   contentLength:', importData.contentLength);
  
  if (!importData.success) { console.error('Import failed:', importData.error); return; }
  const paperId = importData.paper.id;
  
  // Split
  console.log('3. Splitting questions...');
  const splitResp = await postJSON('/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('   Split HTTP:', splitResp.status, 'success:', splitData.success, 'questions:', splitData.questions?.length);
  
  if (splitData.questions) {
    splitData.questions.forEach((q, i) => {
      console.log('   Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length);
    });
  }
  
  // Check for duplicates with paper 9
  console.log('\n4. Checking for duplicates...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const paper9Qs = await prisma.question.findMany({ where: { paperId: 9 }, select: { content: true, questionNumber: true } });
  const paperNewQs = await prisma.question.findMany({ where: { paperId: paperId }, select: { content: true, questionNumber: true, id: true } });
  console.log('   Paper 9 questions:', paper9Qs.length);
  console.log('   Paper ' + paperId + ' questions:', paperNewQs.length);
  
  // Find duplicates by content similarity (first 50 chars)
  let dupCount = 0;
  for (const newQ of paperNewQs) {
    const newQStart = newQ.content?.substring(0, 50) || '';
    const isDup = paper9Qs.some(q => {
      const qStart = q.content?.substring(0, 50) || '';
      return qStart === newQStart && newQStart.length > 10;
    });
    if (isDup) {
      console.log('   DUPLICATE: Q' + newQ.questionNumber + ' (content starts with: ' + newQStart.substring(0,30) + ')');
      dupCount++;
    }
  }
  console.log('   Duplicates found:', dupCount);
  
  // Delete duplicates
  if (dupCount > 0) {
    const toDelete = [];
    for (const newQ of paperNewQs) {
      const newQStart = newQ.content?.substring(0, 50) || '';
      const isDup = paper9Qs.some(q => (q.content?.substring(0, 50) || '') === newQStart && newQStart.length > 10);
      if (isDup) toDelete.push(newQ.id);
    }
    if (toDelete.length > 0) {
      const del = await prisma.question.deleteMany({ where: { id: { in: toDelete } } });
      console.log('   Deleted', del.count, 'duplicates');
    }
  }
  
  const finalCount = await prisma.question.count({ where: { paperId: paperId } });
  console.log('\n=== Final: Paper ' + paperId + ' has ' + finalCount + ' questions (after dedup) ===');
  
  await prisma.$disconnect();
}

main().catch(e => console.error('Error:', e.message));
