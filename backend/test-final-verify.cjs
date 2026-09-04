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
  console.log('=== Re-import PDF with improved splitting ===\n');
  const login = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(login.data).token;
  console.log('1. Login OK');

  console.log('2. Importing PDF (MinerU, ~5min)...');
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '3块布局验证');
  const imp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  const impData = JSON.parse(imp.data);
  console.log('   success:', impData.success, 'parserUsed:', impData.parserUsed, 'paperId:', impData.paper?.id);
  if (!impData.success) { console.error('FAILED:', impData.error); return; }

  console.log('\n3. Splitting questions...');
  const split = await postJSON('/api/papers/' + impData.paper.id + '/split', {}, { Authorization: 'Bearer ' + token });
  const sd = JSON.parse(split.data);
  console.log('   questions:', sd.questions?.length);
  
  if (sd.questions) {
    console.log('\n4. Question details:');
    sd.questions.forEach(q => {
      const hasImg = q.content && q.content.includes('/uploads/');
      const hasLatex = q.content && q.content.includes('$');
      const hasAnswer = q.answer && q.answer.length > 0;
      const hasAnalysis = q.analysis && q.analysis.length > 0;
      console.log(`   Q${q.questionNumber}: content=${q.content?.length||0}chars, answer=${q.answer?.length||0}chars, analysis=${q.analysis?.length||0}chars, img=${hasImg}, latex=${hasLatex}`);
      if (hasImg) {
        const refs = [...q.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
        console.log('     Image refs:', refs.length);
        refs.forEach(r => console.log('       ', r[0].substring(0, 100)));
      }
    });
    
    // Show sample Q with images
    const qWithImg = sd.questions.find(q => q.content && q.content.includes('/uploads/'));
    if (qWithImg) {
      console.log('\n5. Sample question with image (Q' + qWithImg.questionNumber + '):');
      console.log('   Content (300 chars):', qWithImg.content.substring(0, 300));
      console.log('   Answer:', qWithImg.answer?.substring(0, 100));
      console.log('   Analysis:', qWithImg.analysis?.substring(0, 100));
    }
  }
  console.log('\n=== DONE ===');
}
main().catch(e => console.error('Error:', e.message));
