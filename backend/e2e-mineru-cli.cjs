const http = require('http');
const fs = require('fs');

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method, path, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== MinerU CLI E2E Test ===\n');

  // Login
  const loginResp = await request('POST', '/api/auth/login',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ studentId: 'admin1', password: 'admin123' })
  );
  const loginData = JSON.parse(loginResp.data);
  const token = loginData.token;
  console.log('1. Login: OK');

  // Import PDF via API (will trigger MinerU CLI + auto-split)
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: '2026年全国高考二卷数学卷.pdf', contentType: 'application/pdf' });
  form.append('title', 'MinerU CLI测试卷');

  console.log('2. Importing PDF via API (MinerU CLI may take 2-5 minutes)...');
  const formHeaders = form.getHeaders();
  const importResp = await new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import',
      headers: { ...formHeaders, Authorization: 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    form.pipe(req);
  });

  console.log('   Import HTTP:', importResp.status);
  const importData = JSON.parse(importResp.data);
  console.log('   success:', importData.success);
  console.log('   paperId:', importData.paper?.id);
  console.log('   title:', importData.paper?.title);
  console.log('   parserUsed:', importData.parserUsed);
  console.log('   contentLength:', importData.contentLength);
  console.log('   hasMathContent:', importData.hasMathContent);
  console.log('   autoSplit:', JSON.stringify(importData.autoSplit));

  if (importData.paper) {
    const paperId = importData.paper.id;
    // Get questions for this paper
    const qResp = await request('GET', '/api/papers/' + paperId + '/questions',
      { Authorization: 'Bearer ' + token });
    const questions = JSON.parse(qResp.data);
    console.log('\n3. Questions in paper:', Array.isArray(questions) ? questions.length : 'N/A');
    if (Array.isArray(questions) && questions.length > 0) {
      const withLaTeX = questions.filter(q => q.content && q.content.includes('$')).length;
      const withAnswer = questions.filter(q => q.answer && q.answer.length > 0).length;
      const withAnalysis = questions.filter(q => q.analysis && q.analysis.length > 0).length;
      console.log('   With LaTeX:', withLaTeX);
      console.log('   With answer:', withAnswer);
      console.log('   With analysis:', withAnalysis);
      console.log('   Q1 content preview:', questions[0].content?.substring(0, 100));
    }
  }

  console.log('\n=== E2E Test Complete ===');
}

main().catch(e => console.error('Error:', e.message, e.stack));
