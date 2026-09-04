// E2E test with real PDF
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

  // Upload real PDF
  const pdfPath = 'D:/opencode/workspace/senior_middle_school/2026年全国高考二卷数学卷真题及答案解析.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log('PDF size:', pdfBuffer.length, 'bytes');
  
  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), '2026年全国高考二卷数学卷真题及答案解析.pdf');
  form.append('title', '2026年全国高考二卷数学卷真题及答案解析');
  form.append('source', '2026年高考');
  form.append('year', '2026');
  form.append('examType', 'gaokao');
  form.append('totalScore', '150');
  form.append('duration', '120');

  const importResp = await fetch('http://localhost:3000/api/papers/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  
  console.log('Import status:', importResp.status);
  
  // Check content type
  const contentType = importResp.headers.get('content-type');
  console.log('Content-Type:', contentType);
  
  if (contentType && contentType.includes('application/json')) {
    const importData = await importResp.json();
    console.log('✓ Import success:', `paperId=${importData.paper?.id}`, `sourceFormat=${importData.paper?.sourceFormat}`, `contentLength=${importData.contentLength}`);
    console.log('RawContent preview:', importData.paper?.rawContent?.substring(0, 200));
    
    if (importData.paper?.id) {
      console.log('\n--- Splitting questions ---');
      const splitResp = await fetch(`http://localhost:3000/api/papers/${importData.paper.id}/split`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const splitContentType = splitResp.headers.get('content-type');
      console.log('Split status:', splitResp.status, 'Content-Type:', splitContentType);
      
      if (splitContentType && splitContentType.includes('application/json')) {
        const splitData = await splitResp.json();
        console.log('✓ Split success:', `questions=${splitData.questions?.length || 0}`);
        if (splitData.questions) {
          splitData.questions.slice(0, 5).forEach((q, i) => {
            console.log(`  Q${i+1}: type=${q.questionType}, score=${q.score}, content="${q.content?.substring(0, 60)}..."`);
          });
          if (splitData.questions.length > 5) console.log(`  ... and ${splitData.questions.length - 5} more`);
        }
        if (splitData.error) console.log('Split error:', splitData.error);
      } else {
        const text = await splitResp.text();
        console.log('Split response (non-JSON):', text.substring(0, 500));
      }
    }
  } else {
    const text = await importResp.text();
    console.log('Import response (non-JSON):', text.substring(0, 500));
  }
  
  console.log('\n=== Real PDF Test Complete ===');
}

main().catch(e => console.error('Fatal:', e.message));
