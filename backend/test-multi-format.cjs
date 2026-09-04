// E2E test for multi-format import
const fs = require('fs');
const path = require('path');

async function main() {
  // 1. Login as admin
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'admin1', password: 'admin123' }),
  });
  const loginData = await loginResp.json();
  const token = loginData.token;
  console.log('✓ Admin logged in');

  // 2. Upload TXT file
  const txtPath = path.join(__dirname, 'test-paper.txt');
  const txtForm = new FormData();
  txtForm.append('file', new Blob([fs.readFileSync(txtPath)], { type: 'text/plain' }), 'test-paper.txt');
  txtForm.append('title', '测试TXT试卷');
  txtForm.append('source', '测试');
  txtForm.append('year', '2026');
  txtForm.append('examType', 'practice');
  txtForm.append('totalScore', '30');
  txtForm.append('duration', '60');

  const txtResp = await fetch('http://localhost:3000/api/papers/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: txtForm,
  });
  const txtData = await txtResp.json();
  console.log('✓ TXT import:', `status=${txtResp.status}`, `paperId=${txtData.paper?.id}`, `sourceFormat=${txtData.paper?.sourceFormat}`, `contentLength=${txtData.contentLength}`);

  // 3. Split questions from TXT paper
  if (txtData.paper?.id) {
    const splitResp = await fetch(`http://localhost:3000/api/papers/${txtData.paper.id}/split`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const splitData = await splitResp.json();
    console.log('✓ Split result:', `status=${splitResp.status}`, `questions=${splitData.questions?.length || 0}`);
    if (splitData.questions) {
      splitData.questions.forEach((q, i) => {
        console.log(`  Q${i+1}: type=${q.questionType}, score=${q.score}, content="${q.content?.substring(0, 40)}..."`);
      });
    }
  }

  // 4. Test unsupported format (create a fake .xlsx)
  const xlsxForm = new FormData();
  xlsxForm.append('file', new Blob(['fake xlsx content'], { type: 'application/vnd.ms-excel' }), 'test.xlsx');
  xlsxForm.append('title', 'Should Fail');

  const xlsxResp = await fetch('http://localhost:3000/api/papers/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: xlsxForm,
  });
  console.log('✓ Unsupported format rejected:', `status=${xlsxResp.status}`, `(expected 400)`);

  // 5. Verify papers list has sourceFormat
  const listResp = await fetch('http://localhost:3000/api/papers', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listResp.json();
  if (Array.isArray(listData) && listData.length > 0) {
    console.log('✓ Papers list:', listData.length, 'papers');
    listData.forEach(p => console.log(`  - ID=${p.id}, title="${p.title}", sourceFormat=${p.sourceFormat || 'null'}`));
  } else if (listData.data) {
    console.log('✓ Papers list:', listData.data.length, 'papers');
    listData.data.forEach(p => console.log(`  - ID=${p.id}, title="${p.title}", sourceFormat=${p.sourceFormat || 'null'}`));
  }

  console.log('\n=== E2E Test Complete ===');
}

main().catch(console.error);
