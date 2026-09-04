const http = require('http');

function postJSON(port, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port, method: 'POST', path, headers: { 'Content-Type': 'application/json', ...headers } };
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
  const loginResp = await postJSON(3000, '/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  console.log('Login OK');
  
  // Reconstruct all 17 questions for paper 8
  const questionIds = [139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155];
  
  for (let i = 0; i < questionIds.length; i++) {
    const qid = questionIds[i];
    console.log(`\n[${i+1}/17] Reconstructing question ${qid}...`);
    try {
      const resp = await postJSON(3000, `/api/analysis/reconstruct/${qid}`, {}, { Authorization: 'Bearer ' + token });
      if (resp.status === 200) {
        const result = JSON.parse(resp.data);
        if (result.success) {
          const preview = result.content.substring(0, 120);
          console.log(`  OK (${result.content.length} chars): ${preview}...`);
        } else {
          console.log(`  FAILED: ${result.error || 'unknown'}`);
        }
      } else {
        console.log(`  HTTP ${resp.status}: ${resp.data.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
  
  console.log('\n=== All reconstructions complete ===');
}

main().catch(e => console.error('Error:', e.message));
