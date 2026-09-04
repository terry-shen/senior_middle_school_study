const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method, path, headers: headers || {} }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

async function main() {
  // Login
  const loginResp = await request('POST', '/api/auth/login', { 'Content-Type': 'application/json' }, JSON.stringify({ studentId: 'admin1', password: 'admin123' }));
  const token = JSON.parse(loginResp.data).token;
  console.log('1. Login: OK');

  // Import PDF
  const pdfPath = 'D:\\opencode\\workspace\\senior_middle_school\\2026年全国高考二卷数学卷真题及答案解析.pdf';
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: '2026年全国高考二卷.pdf', contentType: 'application/pdf' });
  form.append('title', 'MinerU工作流测试卷');

  console.log('2. Importing PDF via MinerU CLI (~2min)...');
  const importResp = await new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3000, method: 'POST', path: '/api/papers/import', headers: { ...form.getHeaders(), Authorization: 'Bearer ' + token } }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject); form.pipe(req);
  });
  const importData = JSON.parse(importResp.data);
  const paperId = importData.paper?.id;
  console.log('   Import:', importData.success, '| paperId:', paperId, '| parserUsed:', importData.parserUsed, '| contentLength:', importData.contentLength);
  console.log('   autoSplit should be undefined (no auto-split):', importData.autoSplit === undefined ? 'YES ✓' : 'NO ✗');

  // Split preview
  console.log('3. Split preview...');
  const splitResp = await request('POST', '/api/papers/' + paperId + '/split-preview', { Authorization: 'Bearer ' + token });
  const splitData = JSON.parse(splitResp.data);
  console.log('   Split preview:', splitData.success, '| questions:', splitData.questions?.length, '| source:', splitData.source);
  if (splitData.questions) {
    const withLatex = splitData.questions.filter(q => q.content && q.content.includes('$')).length;
    const withAns = splitData.questions.filter(q => q.correctAnswer).length;
    const withAnal = splitData.questions.filter(q => q.analysis).length;
    console.log('   With LaTeX:', withLatex, '| With answer:', withAns, '| With analysis:', withAnal);
    console.log('   Q1 preview:', splitData.questions[0]?.content?.substring(0, 80));
  }

  // Confirm import
  console.log('4. Confirm import...');
  const confirmResp = await request('POST', '/api/papers/' + paperId + '/confirm-import', { Authorization: 'Bearer ' + token });
  const confirmData = JSON.parse(confirmResp.data);
  console.log('   Confirm:', confirmData.success, '| questionsCreated:', confirmData.questionsCreated);

  // Verify questions in DB
  const qResp = await request('GET', '/api/papers/' + paperId + '/questions', { Authorization: 'Bearer ' + token });
  const questions = JSON.parse(qResp.data);
  console.log('5. Questions in DB:', Array.isArray(questions) ? questions.length : 'N/A');

  if (Array.isArray(questions) && questions.length > 0) {
    console.log('   ✅ E2E PASSED: Import → Split Preview → Confirm → Questions in DB');
    console.log('   Question count:', questions.length, '(expected ~18)');
  } else {
    console.log('   ❌ E2E FAILED: No questions in DB');
  }

  // Test 6.5: Draft save
  console.log('\n6. Test draft save...');
  const saveResp = await request('PUT', '/api/papers/' + paperId + '/markdown', { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, JSON.stringify({ editedMarkdown: '# 测试草稿保存\n\n1. 测试题目内容' }));
  const saveData = JSON.parse(saveResp.data);
  console.log('   Save markdown:', saveData.success, '| status:', saveData.paper?.status);
  if (saveData.success && saveData.paper?.editedMarkdown) {
    console.log('   ✅ Draft saved, editedMarkdown exists');
  }

  // Verify draft persists
  const paperResp = await request('GET', '/api/papers/' + paperId, { Authorization: 'Bearer ' + token });
  const paper = JSON.parse(paperResp.data);
  const p = paper.paper || paper;
  console.log('   Paper status:', p.status, '| editedMarkdown exists:', !!p.editedMarkdown);
  if (p.editedMarkdown) {
    console.log('   ✅ Draft persisted after reload');
  }

  console.log('\n=== E2E Test Complete ===');
}

main().catch(e => console.error('Error:', e.message));
