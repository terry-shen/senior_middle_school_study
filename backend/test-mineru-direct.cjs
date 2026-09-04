const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function postForm(port, path, formData) {
  return new Promise((resolve, reject) => {
    const formHeaders = formData.getHeaders();
    const req = http.request({
      host: 'localhost', port, method: 'POST', path,
      headers: { ...formHeaders }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    formData.pipe(req);
  });
}

async function main() {
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\backend\\uploads\\papers\\paper-1788314916128-814469441.pdf';
  console.log('Testing MinerU on:', pdfPath);
  console.log('File exists:', fs.existsSync(pdfPath));
  console.log('File size:', fs.statSync(pdfPath).size, 'bytes');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'test.pdf', contentType: 'application/pdf' });
  
  console.log('Calling MinerU API POST /file_parse...');
  const startTime = Date.now();
  try {
    const resp = await postForm(8080, '/file_parse', form);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('Status:', resp.status, 'Time:', elapsed + 's');
    
    if (resp.status === 200) {
      const data = JSON.parse(resp.data);
      const md = data.md || data.markdown || '';
      console.log('Markdown length:', md.length);
      console.log('Markdown preview (first 300 chars):', md.substring(0, 300));
      console.log('Images count:', (data.images || []).length);
    } else {
      console.log('Response:', resp.data.substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(e => console.error(e));
