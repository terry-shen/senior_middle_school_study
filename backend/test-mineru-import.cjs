const http = require('http');
const fs = require('fs');
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
  console.log('=== 完整导入测试: PDF → MinerU → 题目 ===\n');
  
  // 1. Login
  const login = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(login.data).token;
  console.log('1. 登录: OK');

  // 2. Import PDF (MinerU parsing)
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  console.log('2. 导入PDF (MinerU解析，约4-5分钟)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', '高考数学二卷-MinerU测试');
  const imp = await postForm('/api/papers/import', form, { Authorization: 'Bearer ' + token });
  const impData = JSON.parse(imp.data);
  console.log('   状态:', imp.status, 'success:', impData.success);
  console.log('   paperId:', impData.paper?.id);
  console.log('   parserUsed:', impData.parserUsed);
  console.log('   contentLength:', impData.contentLength);
  console.log('   hasMathContent:', impData.hasMathContent);
  
  if (!impData.success || !impData.paper) { console.error('导入失败:', impData.error); return; }
  const paperId = impData.paper.id;

  // 3. Split questions
  console.log('\n3. 拆分题目...');
  const split = await postJSON('/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
  const split2 = JSON.parse(split.data);
  console.log('   状态:', split.status, 'success:', split2.success, '题目数:', split2.questions?.length);
  
  if (split2.success && split2.questions) {
    const withLatex = split2.questions.filter(q => q.content && q.content.includes('$'));
    console.log('   含LaTeX公式的题目:', withLatex.length);
    const withImages = split2.questions.filter(q => q.content && q.content.includes('images/'));
    console.log('   含图片引用的题目:', withImages.length);
    if (withLatex.length > 0) {
      console.log('\n   示例题目内容 (Q' + withLatex[0].questionNumber + '):');
      console.log('   ' + withLatex[0].content.substring(0, 300));
    }
  }

  console.log('\n=== 导入测试完成 ===');
}

main().catch(e => console.error('Error:', e.message));
