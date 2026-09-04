const http = require('http');
const fs = require('fs');
const path = require('path');

function run() {
  return new Promise((resolve) => {
    const form = require('form-data')();
    const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
    form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
    form.append('title', '高考数学二卷-图片验证');
    
    // First login
    const loginReq = http.request({ host: 'localhost', port: 3000, method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end', () => {
        const token = JSON.parse(d).token;
        // Then import
        const opts = { host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import', headers: { ...form.getHeaders(), Authorization: 'Bearer ' + token } };
        const req = http.request(opts, (res2) => {
          let d2=''; res2.on('data',c=>d2+=c); res2.on('end', () => {
            const r = JSON.parse(d2);
            console.log('Import status:', res2.statusCode);
            console.log('success:', r.success);
            console.log('parserUsed:', r.parserUsed);
            console.log('paperId:', r.paper?.id);
            console.log('contentLength:', r.contentLength);
            resolve(r);
          });
        });
        req.on('error', e => { console.error('Import error:', e.message); resolve(null); });
        form.pipe(req);
      });
    });
    loginReq.on('error', e => { console.error('Login error:', e.message); resolve(null); });
    loginReq.write(JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
    loginReq.end();
  });
}

(async () => {
  console.log('Importing PDF to verify image saving (takes ~5 min)...');
  const r = await run();
  if (r && r.success) {
    // Check if images were saved
    const imgsDir = path.join(process.cwd(), 'uploads', 'papers', 'mineru-images');
    if (fs.existsSync(imgsDir)) {
      const files = fs.readdirSync(imgsDir);
      console.log('\nSaved images:', files.length);
      files.slice(0,5).forEach(f => {
        const stat = fs.statSync(path.join(imgsDir, f));
        console.log('  ', f, '-', Math.round(stat.size/1024) + 'KB');
      });
    } else {
      console.log('No mineru-images directory found');
    }
  }
})();
