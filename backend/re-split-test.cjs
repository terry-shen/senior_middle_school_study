const http = require('http');

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
  // Login
  const loginResp = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
  const token = JSON.parse(loginResp.data).token;
  console.log('Login: OK');

  // Delete existing questions for paper 6
  const delResp = await request('DELETE', '/api/papers/questions/before-re-split/6', { Authorization: 'Bearer ' + token });
  // This endpoint might not exist, so just re-split which should handle existing
  
  // Re-split paper 6
  console.log('Splitting paper 6...');
  const splitResp = await request('POST', '/api/papers/6/split', { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, '{}');
  console.log('Split HTTP:', splitResp.status);
  const splitData = JSON.parse(splitResp.data);
  console.log('Split success:', splitData.success);
  if (splitData.questions) {
    console.log('Questions:', splitData.questions.length);
    let withAnalysis = 0;
    let withAnswer = 0;
    for (const q of splitData.questions) {
      if (q.analysis) withAnalysis++;
      if (q.answer) withAnswer++;
    }
    console.log('With analysis:', withAnalysis);
    console.log('With answer:', withAnswer);
    // Show Q1 content preview
    console.log('\nQ1 content (100 chars):', splitData.questions[0].content.substring(0, 100));
    console.log('Q1 answer:', splitData.questions[0].answer);
    console.log('Q1 analysis (100 chars):', (splitData.questions[0].analysis || '').substring(0, 100));
  }
}
main().catch(e => console.error('Error:', e.message));
