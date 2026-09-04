const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function postForm(urlPath, formData, headers) {
  return new Promise((resolve, reject) => {
    const formHeaders = formData.getHeaders();
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { ...formHeaders, ...headers } }, (res) => {
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
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); req.write(JSON.stringify(body)); req.end();
  });
}

async function main() {
  // Login
  const login = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(login.data).token;
  console.log('1. Login: OK');
  
  // Import PDF
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  console.log('2. Importing PDF via MinerU (2-5 min)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '图片修复验证卷');
  const importResp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  const importData = JSON.parse(importResp.data);
  console.log('   Import: success=' + importData.success + ' paperId=' + importData.paper?.id + ' parserUsed=' + importData.parserUsed);
  
  if (!importData.success) { console.log('   FAILED:', importData.error); return; }
  const paperId = importData.paper.id;
  
  // Check image files
  const imgDir = 'D:\\opencode\\workspace\\senior_middle_school\\backend\\uploads\\papers\\mineru-images';
  const allFiles = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg'));
  // Get the newest files (by modification time)
  const newFiles = allFiles.map(f => ({ name: f, mtime: fs.statSync(imgDir + '\\' + f).mtime }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5);
  
  console.log('\n3. Checking newest image files:');
  let validCount = 0;
  for (const f of newFiles) {
    const fp = imgDir + '\\' + f.name;
    const bytes = fs.readFileSync(fp);
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    console.log('   ' + f.name + ': ' + bytes.length + ' bytes, validJPEG=' + isJPEG + ' (magic: ' + bytes[0].toString(16) + ' ' + bytes[1].toString(16) + ' ' + bytes[2].toString(16) + ')');
    if (isJPEG) validCount++;
  }
  console.log('   Valid JPEGs: ' + validCount + '/' + newFiles.length);
  
  // Split
  console.log('\n4. Splitting paper ' + paperId + '...');
  const split = await postJSON('/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(split.data);
  console.log('   Split: success=' + splitData.success + ' questions=' + (splitData.questions?.length || 0));
  
  // Check question content for image refs
  if (splitData.questions) {
    let imgQCount = 0;
    splitData.questions.forEach(q => {
      const allText = [q.content || '', q.analysis || '', q.answer || ''].join('\n');
      if (allText.includes('![]') || allText.includes('/uploads/')) {
        imgQCount++;
      }
    });
    console.log('   Questions with image refs: ' + imgQCount);
  }
  
  console.log('\n=== Done ===');
}
main().catch(e => console.error('Error:', e.message));
