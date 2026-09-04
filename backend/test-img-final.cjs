const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

function postForm(urlPath, formData, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { ...formData.getHeaders(), ...headers } };
    const req = http.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:d})); });
    req.on('error', reject); formData.pipe(req);
  });
}
function postJSON(urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,data:d})); });
    req.on('error', reject); req.write(JSON.stringify(body)); req.end();
  });
}

async function main() {
  console.log('=== 导入PDF验证图片保存 ===\n');
  const login = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(login.data).token;
  console.log('1. Login OK');

  console.log('2. 导入PDF (MinerU, ~5min)...');
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '图片验证最终测试');
  const imp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  const impData = JSON.parse(imp.data);
  console.log('   success:', impData.success, 'parserUsed:', impData.parserUsed, 'paperId:', impData.paper?.id);
  
  if (!impData.success) { console.error('FAILED:', impData.error); return; }

  // Check images saved
  const imgsDir = path.join(process.cwd(), 'uploads', 'papers', 'mineru-images');
  console.log('\n3. mineru-images dir:', fs.existsSync(imgsDir) ? 'EXISTS' : 'NOT FOUND');
  if (fs.existsSync(imgsDir)) {
    const files = fs.readdirSync(imgsDir);
    console.log('   Files:', files.length);
    files.slice(0,5).forEach(f => console.log('   ', f, Math.round(fs.statSync(path.join(imgsDir,f)).size/1024)+'KB'));
  }

  // Check backend log
  const logPath = path.join(process.cwd(), 'mineru-run.log');
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath,'utf8').split('\n').filter(l => l.includes('mineru-service'));
    console.log('\n4. mineru-service logs (' + lines.length + ' lines):');
    lines.slice(-8).forEach(l => console.log('   ', l.trim().substring(0,200)));
  }

  // Split and check
  console.log('\n5. Splitting...');
  const split = await postJSON('/api/papers/' + impData.paper.id + '/split', {}, { Authorization: 'Bearer ' + token });
  const sd = JSON.parse(split.data);
  console.log('   questions:', sd.questions?.length);
  if (sd.questions) {
    const wImg = sd.questions.filter(q => q.content && q.content.includes('/uploads/'));
    console.log('   with /uploads/ image:', wImg.length);
    if (wImg.length > 0) console.log('   sample:', wImg[0].content.substring(0, 300));
  }
  console.log('\n=== DONE ===');
}
main().catch(e => console.error('Error:', e.message));
