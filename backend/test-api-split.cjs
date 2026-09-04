const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path, headers }, (res) => {
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
  // Login
  const loginResp = await post('/api/auth/login', JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
  const loginData = JSON.parse(loginResp.data);
  if (!loginData.success) { console.error('Login failed:', loginResp.data); return; }
  const token = loginData.token;
  console.log('Login: OK');

  // Split paper 6
  console.log('\nSplitting paper 6...');
  const splitResp = await post('/api/papers/6/split', '{}', token);
  console.log('HTTP:', splitResp.status);
  
  if (splitResp.status !== 200) {
    console.error('Split failed:', splitResp.data.substring(0, 500));
    return;
  }
  
  const splitData = JSON.parse(splitResp.data);
  console.log('Success:', splitData.success);
  const questions = splitData.questions || [];
  console.log('Questions:', questions.length);
  
  // Show details
  questions.forEach(q => {
    const ansLen = q.answer ? q.answer.length : 0;
    const anaLen = q.analysis ? q.analysis.length : 0;
    const imgCount = (q.content.match(/!\[.*?\]\(.*?\)/g) || []).length;
    console.log(`  Q${q.questionNumber}: content=${q.content.length}, answer=${ansLen}, analysis=${anaLen}, type=${q.questionType}, images=${imgCount}`);
  });
  
  // Summary
  const withAnalysis = questions.filter(q => q.analysis && q.analysis.length > 0).length;
  const withAnswer = questions.filter(q => q.answer && q.answer.length > 0).length;
  const withImages = questions.filter(q => q.content.includes('![') || q.content.includes('/uploads/')).length;
  console.log(`\nSummary: ${questions.length} questions, ${withAnswer} with answers, ${withAnalysis} with analysis, ${withImages} with images`);
}

main().catch(e => console.error('Error:', e.message));
