const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

function postForm(port, urlPath, formData, headers) {
  return new Promise((resolve, reject) => {
    const formHeaders = formData.getHeaders();
    const opts = {
      host: 'localhost', port, method: 'POST', path: urlPath,
      headers: { ...formHeaders, ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    formData.pipe(req);
  });
}

function postJSON(port, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      host: 'localhost', port, method: 'POST', path: urlPath,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
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

function getJSON(port, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port, method: 'GET', path: urlPath, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Full E2E Test: Import PDF + Page Images + Reconstruct ===\n');

  // Step 1: Login
  const loginResp = await postJSON(3000, '/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const loginData = JSON.parse(loginResp.data);
  const token = loginData.token;
  console.log('1. Login: OK');

  // Step 2: Import PDF (with page image rendering)
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  console.log('2. Importing PDF (text extraction + page rendering, may take 60s)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: 'math_exam.pdf', contentType: 'application/pdf' });
  form.append('title', 'E2E数学公式测试卷');
  const importResp = await postForm(3000, '/api/papers/import', form, { Authorization: 'Bearer ' + token });
  console.log('   Import HTTP:', importResp.status);
  const importData = JSON.parse(importResp.data);
  console.log('   success:', importData.success);
  console.log('   paperId:', importData.paper?.id);
  console.log('   contentLength:', importData.contentLength);
  console.log('   hasMathContent:', importData.hasMathContent);
  console.log('   extractionFallback:', importData.extractionFallback);
  console.log('   pageImagesCount:', importData.pageImagesCount);

  if (!importData.success || !importData.paper) {
    console.error('Import failed:', importData.error);
    return;
  }
  const paperId = importData.paper.id;

  // Step 3: Get paper detail (verify pageImages)
  const paperResp = await getJSON(3000, '/api/papers/' + paperId, { Authorization: 'Bearer ' + token });
  const paperData = JSON.parse(paperResp.data);
  const pi = paperData.pageImages;
  console.log('\n3. Paper detail:');
  console.log('   title:', paperData.title);
  console.log('   pageImages:', Array.isArray(pi) ? pi.length + ' images' : pi);
  if (Array.isArray(pi) && pi.length > 0) {
    console.log('   First 3 page image URLs:');
    pi.slice(0, 3).forEach((url, i) => console.log('     [' + (i+1) + ']', url));
  }

  // Step 4: Test page-images endpoint
  const piResp = await getJSON(3000, '/api/papers/' + paperId + '/page-images', { Authorization: 'Bearer ' + token });
  const piData = JSON.parse(piResp.data);
  console.log('\n4. Page-images API: success=' + piData.success + ' count=' + piData.count);

  // Step 5: Split questions
  console.log('\n5. Splitting questions...');
  const splitResp = await postJSON(3000, '/api/papers/' + paperId + '/split', {}, { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('   Split HTTP:', splitResp.status, 'success:', splitData.success, 'questions:', splitData.questions?.length);

  // Step 6: Test reconstruct endpoint on first question
  if (splitData.questions && splitData.questions.length > 0) {
    const qId = splitData.questions[0].id;
    console.log('\n6. Testing reconstruct on question', qId, '(may take 30-60s with local LLM)...');
    const rcResp = await postJSON(3000, '/api/analysis/reconstruct/' + qId, {}, { Authorization: 'Bearer ' + token });
    console.log('   Reconstruct HTTP:', rcResp.status);
    if (rcResp.status === 200) {
      const rcData = JSON.parse(rcResp.data);
      console.log('   success:', rcData.success);
      if (rcData.content) {
        console.log('   content preview (first 200 chars):', rcData.content.substring(0, 200));
      }
    } else {
      console.log('   Response:', rcResp.data.substring(0, 300));
    }
  }

  console.log('\n=== E2E Test Complete ===');
}

main().catch(e => console.error('Error:', e.message, e.stack));
