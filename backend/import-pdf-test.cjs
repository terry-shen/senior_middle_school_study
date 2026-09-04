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

  // Import PDF
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  console.log('2. Importing PDF (MinerU parsing, may take 2-5 min)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: '2026_math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '2026年全国高考二卷数学卷');
  const importResp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  console.log('   HTTP:', importResp.status);
  const importData = JSON.parse(importResp.data);
  console.log('   success:', importData.success);
  console.log('   paperId:', importData.paper?.id);
  console.log('   parserUsed:', importData.parserUsed);
  console.log('   contentLength:', importData.contentLength);
  console.log('   pageImagesCount:', importData.pageImagesCount);
  
  if (!importData.success) { console.error('Import failed:', importData.error); return; }
  const paperId = importData.paper.id;
  
  // Split
  console.log('3. Splitting questions...');
  const splitResp = await postJSON('/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('   Split HTTP:', splitResp.status, 'success:', splitData.success, 'questions:', splitData.questions?.length);
  
  if (splitData.questions) {
    splitData.questions.forEach((q, i) => {
      const hasAns = q.answer ? 'Y' : 'N';
      const hasAnal = q.analysis ? 'Y' : 'N';
      console.log('   Q' + (i+1) + ': content=' + q.content?.length + ' ans=' + hasAns + ' anal=' + hasAnal + ' type=' + q.questionType);
    });
  }
  
  console.log('\n=== PDF Import Complete ===');
}

main().catch(e => console.error('Error:', e.message));
