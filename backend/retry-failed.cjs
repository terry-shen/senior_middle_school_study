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
  const loginResp = await postJSON(3000, '/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  
  // Only re-run the 5 that had chain-of-thought output
  const failedIds = [141, 144, 147, 150, 152];
  for (let i = 0; i < failedIds.length; i++) {
    const qid = failedIds[i];
    process.stdout.write(`[${i+1}/5] Q${qid}... `);
    try {
      const resp = await postJSON(3000, `/api/analysis/reconstruct/${qid}`, {}, { Authorization: 'Bearer ' + token });
      if (resp.status === 200) {
        const result = JSON.parse(resp.data);
        if (result.success) {
          const preview = result.content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`OK: ${preview}...`);
        } else {
          console.log(`SKIPPED: ${result.message}`);
        }
      } else {
        console.log(`HTTP ${resp.status}`);
      }
    } catch (e) { console.log(`ERROR: ${e.message}`); }
  }
  console.log('\nDone');
}
main().catch(e => console.error('Error:', e.message));
