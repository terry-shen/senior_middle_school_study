const http = require('http');
function postJSON(urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, method: 'POST', path: urlPath, headers: { 'Content-Type': 'application/json', ...headers } };
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
  const loginResp = await postJSON('/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  
  const splitResp = await postJSON('/api/papers/9/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('Split:', splitData.success, 'questions:', splitData.questions?.length);
  if (splitData.questions) {
    splitData.questions.forEach((q, i) => {
      console.log('Q' + (i+1) + ': num=' + q.questionNumber + ' content=' + q.content?.length + ' ans=' + (q.answer?'Y':'N') + ' anal=' + (q.analysis?'Y':'N'));
    });
  }
}
main().catch(e => console.error(e));
