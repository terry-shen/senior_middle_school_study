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
  // 1. Delete ALL papers and questions
  await prisma.question.deleteMany({});
  await prisma.examPaper.deleteMany({});
  console.log('All papers and questions deleted');

  // 2. Login
  const loginResp = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
  const token = JSON.parse(loginResp.data).token;
  console.log('Login OK');

  // 3. Import PDF via API (MinerU CLI will process it ~2min)
  const FormData = require('form-data');
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: '2026年全国高考二卷.pdf', contentType: 'application/pdf' });
  form.append('title', '2026年全国高考二卷数学卷');

  console.log('Importing PDF (MinerU CLI ~2min, auto-tag after parse)...');
  const importResp = await new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import', headers: { ...form.getHeaders(), Authorization: 'Bearer ' + token } }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); form.pipe(req);
  });

  const importData = JSON.parse(importResp.data);
  console.log('Import:', importData.success, '| paperId:', importData.paper?.id, '| parserUsed:', importData.parserUsed, '| contentLength:', importData.contentLength);

  const paperId = importData.paper?.id;

  // 4. Split preview
  console.log('\n=== Split Preview ===');
  const splitResp = await request('POST', '/api/papers/' + paperId + '/split-preview', { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('Split preview questions:', splitData.questions?.length || 0);
  if (splitData.questions) {
    splitData.questions.forEach(q => {
      const hasLatex = q.content && q.content.includes('$') ? 'Y' : 'N';
      const hasAns = q.correctAnswer ? 'Y' : 'N';
      const hasAnal = q.analysis ? 'Y' : 'N';
      console.log('  Q' + q.questionNumber + ': content=' + (q.content?.length || 0) + ' latex=' + hasLatex + ' ans=' + hasAns + ' anal=' + hasAnal);
    });
  }

  // 5. Confirm import
  console.log('\n=== Confirm Import ===');
  const confirmResp = await request('POST', '/api/papers/' + paperId + '/confirm-import', { Authorization: 'Bearer ' + token });
  const confirmData = JSON.parse(confirmResp.data);
  console.log('Confirm:', JSON.stringify(confirmData));

  // 6. Verify DB
  const qCount = await prisma.question.count({ where: { paperId } });
  console.log('\nDB questions for paper', paperId, ':', qCount);

  const questions = await prisma.question.findMany({ where: { paperId }, orderBy: { questionNumber: 'asc' } });
  const withLatex = questions.filter(q => q.content && q.content.includes('$')).length;
  const withAns = questions.filter(q => q.answer && q.answer.length > 0).length;
  const withAnal = questions.filter(q => q.analysis && q.analysis.length > 0).length;
  console.log('With LaTeX:', withLatex, '| With answer:', withAns, '| With analysis:', withAnal);

  console.log('\n=== E2E Test Complete ===');
  console.log('Expected: 19 questions');
  console.log('Got:', qCount, 'questions');
  if (qCount === 19) {
    console.log('✅ CORRECT! 19 questions as expected.');
  } else {
    console.log('⚠️ Got ' + qCount + ' (expected 19)');
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error('Error:', e.message));
