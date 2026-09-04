const http = require('http');
function postJSON(port, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port, method: 'POST', path: urlPath, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); req.write(JSON.stringify(body)); req.end();
  });
}
function getJSON(port, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port, method: 'GET', path: urlPath, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); req.end();
  });
}
async function main() {
  // Login
  const login = await postJSON(3000, '/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(login.data).token;
  console.log('Login: OK');
  
  // Split paper 6
  console.log('Splitting paper 6...');
  const split = await postJSON(3000, '/api/papers/6/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(split.data);
  console.log('Split: success=' + splitData.success + ' questions=' + (splitData.questions?.length || 0));
  
  if (splitData.questions) {
    // Check which questions have image refs
    splitData.questions.forEach(q => {
      const allText = [q.content || '', q.analysis || '', q.answer || ''].join(' ');
      if (allText.includes('![]') || allText.includes('/uploads/') || allText.includes('.jpg') || allText.includes('.png')) {
        console.log('  Q' + q.id + ' has image ref');
        // Show the image line
        const lines = allText.split('\n');
        lines.forEach(line => {
          if (line.includes('![]') || line.includes('/uploads/') || line.includes('.jpg') || line.includes('.png')) {
            console.log('    ' + line.substring(0, 200));
          }
        });
      }
    });
  }
  
  // Verify image files exist
  console.log('\nVerifying image files...');
  const piResp = await getJSON(3000, '/api/papers/6/page-images', { Authorization: 'Bearer ' + token });
  const piData = JSON.parse(piResp.data);
  console.log('Page images count:', piData.count);
}
main().catch(e => console.error('Error:', e));
