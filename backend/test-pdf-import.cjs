// E2E test: PDF import + split
const fs = require('fs');
const path = require('path');

async function main() {
  // Login
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'admin1', password: 'admin123' }),
  });
  const { token } = await loginResp.json();
  console.log('✓ Admin logged in');

  // Upload PDF
  const pdfPath = path.join(__dirname, 'test-exam.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'test-exam.pdf');
  form.append('title', '测试PDF试卷');
  form.append('source', '测试');
  form.append('year', '2026');
  form.append('examType', 'practice');
  form.append('totalScore', '20');
  form.append('duration', '60');

  const importResp = await fetch('http://localhost:3000/api/papers/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const importData = await importResp.json();
  console.log('✓ PDF import:', `status=${importResp.status}`, `paperId=${importData.paper?.id}`, `sourceFormat=${importData.paper?.sourceFormat}`, `contentLength=${importData.contentLength}`);
  console.log('  RawContent preview:', importData.paper?.rawContent?.substring(0, 100));

  // Split questions
  if (importData.paper?.id) {
    const splitResp = await fetch(`http://localhost:3000/api/papers/${importData.paper.id}/split`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const splitData = await splitResp.json();
    console.log('\n✓ Split result:', `status=${splitResp.status}`, `questions=${splitData.questions?.length || 0}`);
    if (splitData.questions) {
      splitData.questions.forEach((q, i) => {
        console.log(`  Q${i+1}: type=${q.questionType}, score=${q.score}, content="${q.content?.substring(0, 60)}..."`);
      });
    }
  }

  console.log('\n=== PDF Import Test Complete ===');
}

main().catch(console.error);
