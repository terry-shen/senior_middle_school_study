const http = require('http');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method, path, headers: headers || {} }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

async function main() {
  console.log('=== Tag-Based Splitting E2E Test ===\n');

  // 1. Clean up
  await prisma.question.deleteMany({});
  await prisma.examPaper.deleteMany({});
  console.log('1. Cleaned DB');

  // 2. Login
  const loginResp = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
  const token = JSON.parse(loginResp.data).token;
  console.log('2. Login OK');

  // 3. Import PDF (MinerU async + autoTag)
  const FormData = require('form-data');
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: '2026年全国高考二卷.pdf', contentType: 'application/pdf' });
  form.append('title', '2026年全国高考二卷数学卷');

  console.log('3. Importing PDF (MinerU ~2min + autoTag)...');
  const importResp = await new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import', headers: { ...form.getHeaders(), Authorization: 'Bearer ' + token } }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); form.pipe(req);
  });

  const importData = JSON.parse(importResp.data);
  console.log('   Import:', importData.success, '| paperId:', importData.paper?.id, '| parserUsed:', importData.parserUsed, '| contentLength:', importData.contentLength);

  const paperId = importData.paper?.id;
  if (!paperId) { console.log('FAILED: No paperId'); return; }

  // 4. Check paper has editedMarkdown with tags
  const paperResp = await request('GET', '/api/papers/' + paperId, { Authorization: 'Bearer ' + token });
  const paper = JSON.parse(paperResp.data);
  const paperObj = paper.paper || paper;
  const editedMd = paperObj.editedMarkdown || '';
  const tagStarts = (editedMd.match(/<!--Q\d+_START-->/g) || []).length;
  const tagEnds = (editedMd.match(/<!--Q\d+_END-->/g) || []).length;
  console.log('4. editedMarkdown:', editedMd.length, 'chars | START tags:', tagStarts, '| END tags:', tagEnds);

  // 5. Split preview (uses tag-based splitting)
  console.log('5. Split preview...');
  const splitResp = await request('POST', '/api/papers/' + paperId + '/split-preview', { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('   Split preview:', splitData.success, '| questions:', splitData.questions?.length || 0, '| source:', splitData.source);

  if (splitData.questions) {
    let withLatex = 0, withAns = 0, withAnal = 0;
    splitData.questions.forEach(q => {
      if (q.content && q.content.includes('$')) withLatex++;
      if (q.answer && q.answer.length > 0) withAns++;
      if (q.analysis && q.analysis.length > 0) withAnal++;
    });
    console.log('   With LaTeX:', withLatex, '| With answer:', withAns, '| With analysis:', withAnal);
    console.log('   Q1 preview:', (splitData.questions[0]?.content || '').substring(0, 80));
  }

  // 6. Confirm import (saves to DB)
  console.log('6. Confirm import...');
  const confirmResp = await request('POST', '/api/papers/' + paperId + '/confirm-import', { Authorization: 'Bearer ' + token });
  const confirmData = JSON.parse(confirmResp.data);
  console.log('   Confirm:', confirmData.success, '| created:', confirmData.created, '| updated:', confirmData.updated);

  // 7. Verify DB
  const dbCount = await prisma.question.count({ where: { paperId } });
  console.log('7. DB questions count:', dbCount);

  // 8. Test re-split (update, not recreate)
  console.log('8. Re-confirm import (should update, not create new)...');
  const confirm2Resp = await request('POST', '/api/papers/' + paperId + '/confirm-import', { Authorization: 'Bearer ' + token });
  const confirm2Data = JSON.parse(confirm2Resp.data);
  console.log('   Re-confirm:', confirm2Data.success, '| created:', confirm2Data.created, '| updated:', confirm2Data.updated);
  const dbCount2 = await prisma.question.count({ where: { paperId } });
  console.log('   DB questions count after re-confirm:', dbCount2, '(should be same)');

  // 9. Test source download
  console.log('9. Download source file...');
  const dlResp = await request('GET', '/api/papers/' + paperId + '/download-source', { Authorization: 'Bearer ' + token });
  console.log('   Download status:', dlResp.status, '| content-length:', dlResp.data.length > 100 ? 'OK (binary)' : dlResp.data.substring(0, 100));

  console.log('\n=== E2E Test Complete ===');
  console.log('Expected: 18-19 questions with LaTeX, answer, analysis');
  console.log('Got:', dbCount, 'questions');
}

main().then(() => prisma.$disconnect()).catch(e => console.error('Error:', e.message));
