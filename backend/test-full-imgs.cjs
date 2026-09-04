const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testFull() {
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('files', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('backend', 'pipeline');
  form.append('lang_list', 'ch');
  form.append('formula_enable', 'true');
  form.append('table_enable', 'true');
  form.append('return_md', 'true');
  form.append('return_images', 'true');

  console.log('=== FULL PDF parse (no page limit, ~5 min) ===');
  const resp = await axios.post('http://127.0.0.1:8080/file_parse', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 600000,
  });
  const data = resp.data;
  console.log('Status:', data.status);
  const results = data.results || {};
  const keys = Object.keys(results);
  if (keys.length > 0) {
    const r = results[keys[0]];
    console.log('Result keys:', Object.keys(r));
    console.log('images field present:', 'images' in r);
    if ('images' in r) {
      const imgs = r.images;
      if (typeof imgs === 'object' && imgs) {
        console.log('images count:', Object.keys(imgs).length);
      } else {
        console.log('images type:', typeof imgs, imgs ? imgs.length : imgs);
      }
    }
    const md = r.md_content || '';
    console.log('md_content length:', md.length);
    // Find image references in markdown
    const refs = md.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
    console.log('Image refs in markdown:', refs.length);
    refs.slice(0,5).forEach(ref => console.log('  ref:', ref));
    // Save md
    fs.writeFileSync('full-md-sample.txt', md, 'utf8');
    fs.writeFileSync('full-parse-check.json', JSON.stringify({
      status: data.status,
      resultKeys: Object.keys(r),
      hasImages: 'images' in r,
      imagesCount: (typeof r.images === 'object' && r.images) ? Object.keys(r.images).length : -1,
      mdLength: md.length,
      imageRefCount: refs.length,
    }));
  }
}
testFull().catch(e => console.error('Error:', e.message));
