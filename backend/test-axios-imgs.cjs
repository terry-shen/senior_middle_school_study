const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function test() {
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('files', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('backend', 'pipeline');
  form.append('lang_list', 'ch');
  form.append('formula_enable', 'true');
  form.append('table_enable', 'true');
  form.append('return_md', 'true');
  form.append('return_images', 'true');
  // Limit to pages 15-16 (has images)
  form.append('start_page_id', '14');
  form.append('end_page_id', '15');

  console.log('Calling MinerU API with return_images=true (pages 15-16)...');
  const resp = await axios.post('http://127.0.0.1:8080/file_parse', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 300000,
  });
  const data = resp.data;
  console.log('Status:', data.status);
  const results = data.results || {};
  const keys = Object.keys(results);
  console.log('Result keys:', keys);
  if (keys.length > 0) {
    const r = results[keys[0]];
    console.log('Result object keys:', Object.keys(r));
    if ('images' in r) {
      const imgs = r.images;
      console.log('images type:', typeof imgs);
      if (typeof imgs === 'object' && imgs !== null) {
        console.log('images keys:', Object.keys(imgs).length);
        const k = Object.keys(imgs)[0];
        if (k) { console.log('first key:', k, 'value type:', typeof imgs[k], 'len:', (imgs[k]||'').length); }
      } else if (typeof imgs === 'string') {
        console.log('images is string, length:', imgs.length);
      }
    } else {
      console.log('NO images field in result!');
    }
  }
}
test().catch(e => console.error('Error:', e.message));
