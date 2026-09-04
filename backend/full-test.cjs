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

  console.log('Importing PDF (MinerU CLI ~2min, then auto-split)...');
  const importResp = await new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import', headers: { ...form.getHeaders(), Authorization: 'Bearer ' + token } }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); form.pipe(req);
  });

  const importData = JSON.parse(importResp.data);
  console.log('Import:', importData.success, '| paperId:', importData.paper?.id, '| parserUsed:', importData.parserUsed, '| autoSplit:', JSON.stringify(importData.autoSplit));

  // 4. Verify questions
  const paperId = importData.paper?.id;
  if (paperId) {
    const qResp = await request('GET', '/api/papers/' + paperId + '/questions', { Authorization: 'Bearer ' + token });
    const questions = JSON.parse(qResp.data);
    console.log('\n=== Questions: ' + questions.length + ' ===');
    questions.forEach(q => {
      const hasLatex = q.content && q.content.includes('$') ? 'Y' : 'N';
      const hasAns = q.answer && q.answer.length > 0 ? 'Y' : 'N';
      const hasAnal = q.analysis && q.analysis.length > 0 ? 'Y' : 'N';
      const preview = (q.content || '').substring(0, 50).replace(/\n/g, ' ');
      console.log('  Q' + q.questionNumber + ': content=' + (q.content?.length || 0) + ' latex=' + hasLatex + ' ans=' + hasAns + ' anal=' + hasAnal + ' | ' + preview);
    });
    console.log('\nExpected: 19 questions (8 choice + 3 multi-choice + 3 fill + 5 essay)');
    console.log('Got: ' + questions.length + ' questions');
    if (questions.length === 19) {
      console.log('✅ CORRECT! 19 questions as expected.');
    } else if (questions.length === 18) {
      console.log('⚠️  Got 18 (MinerU may have merged 2 questions). Need to check.');
    } else {
      console.log('❌ WRONG! Expected 19, got ' + questions.length);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error('Error:', e.message));
