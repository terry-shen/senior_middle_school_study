const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function postForm(urlPath, formData) {
  return new Promise((resolve, reject) => {
    const formHeaders = formData.getHeaders();
    const req = http.request({ host: '127.0.0.1', port: 8080, method: 'POST', path: urlPath, headers: formHeaders }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    formData.pipe(req);
  });
}

async function main() {
  // Check MinerU health
  const healthResp = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 8080, path: '/health' }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
  console.log('Health:', healthResp);

  // Parse a small PDF to check image format
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('files', fs.createReadStream(pdfPath), { filename: 'test.pdf' });
  form.append('backend', 'pipeline');
  form.append('lang_list', 'ch');
  form.append('formula_enable', 'true');
  form.append('return_md', 'true');
  form.append('return_images', 'true');

  console.log('Calling MinerU API...');
  const resp = await postForm('/file_parse', form);
  const data = JSON.parse(resp.data);
  
  if (data.results) {
    const keys = Object.keys(data.results);
    const first = data.results[keys[0]];
    const images = first.images || {};
    const imgKeys = Object.keys(images);
    console.log('Image keys:', imgKeys.length);
    if (imgKeys.length > 0) {
      const firstImg = images[imgKeys[0]];
      console.log('First image key:', imgKeys[0]);
      console.log('First image type:', typeof firstImg);
      console.log('First image length:', firstImg.length);
      console.log('First 50 chars:', firstImg.substring(0, 50));
      // Check if it's base64
      const isBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(firstImg.substring(0, 100));
      console.log('Is base64:', isBase64);
      // Try decoding
      const decoded = Buffer.from(firstImg, 'base64');
      console.log('Decoded length:', decoded.length);
      console.log('Decoded first 4 bytes:', decoded[0], decoded[1], decoded[2], decoded[3]);
      console.log('Hex:', decoded[0].toString(16), decoded[1].toString(16), decoded[2].toString(16), decoded[3].toString(16));
    }
  }
}
main().catch(e => console.error('Error:', e.message));
