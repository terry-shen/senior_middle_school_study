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
  console.log('Login: OK');
  
  // Import PDF with MinerU
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  console.log('Importing PDF via MinerU (may take 2-5 minutes)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '数学公式+图片测试卷');
  
  const importResp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  const importData = JSON.parse(importResp.data);
  console.log('Import: success=' + importData.success + ' paperId=' + (importData.paper?.id) + ' parserUsed=' + importData.parserUsed + ' pageImagesCount=' + importData.pageImagesCount);
  
  if (importData.success && importData.paper) {
    const paperId = importData.paper.id;
    
    // Verify images are valid JPEGs now
    const imgDir = 'D:\\opencode\\workspace\\senior_middle_school\\backend\\uploads\\papers\\mineru-images';
    const files = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg'));
    console.log('\nChecking ' + files.length + ' image files...');
    let validCount = 0;
    for (const f of files.slice(-5)) { // Check last 5 (newest)
      const fp = imgDir + '\\' + f;
      const bytes = fs.readFileSync(fp);
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      console.log('  ' + f + ': ' + bytes.length + ' bytes, valid JPEG=' + isJPEG + ' (magic: ' + bytes[0].toString(16) + ' ' + bytes[1].toString(16) + ' ' + bytes[2].toString(16) + ')');
      if (isJPEG) validCount++;
    }
    
    // Split the paper
    console.log('\nSplitting paper ' + paperId + '...');
    const split = await postJSON('/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
    const splitData = JSON.parse(split.data);
    console.log('Split: success=' + splitData.success + ' questions=' + (splitData.questions?.length || 0));
  }
}
main().catch(e => console.error('Error:', e.message));
