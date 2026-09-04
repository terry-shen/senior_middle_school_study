const { PrismaClient } = require('@prisma/client');
const http = require('http');
const prisma = new PrismaClient();

function postJSON(port, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port, method: 'POST', path: urlPath, headers: { 'Content-Type': 'application/json', ...headers } };
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
  // Get first question from DB
  const q = await prisma.question.findFirst({ orderBy: { id: 'asc' } });
  if (!q) { console.log('No questions in DB'); return; }
  console.log('Found question:', q.id, '| type:', q.questionType, '| content preview:', q.content.substring(0, 80));
  
  // Login
  const loginResp = await postJSON(3000, '/api/auth/login', { studentId: 'admin1', password: 'admin123' });
  const token = JSON.parse(loginResp.data).token;
  
  // Test reconstruct
  console.log('\nTesting reconstruct on question', q.id, '(LLM call, may take 30-60s)...');
  const rcResp = await postJSON(3000, '/api/analysis/reconstruct/' + q.id, {}, { Authorization: 'Bearer ' + token });
  console.log('HTTP:', rcResp.status);
  if (rcResp.status === 200) {
    const rc = JSON.parse(rcResp.data);
    console.log('success:', rc.success);
    if (rc.content) {
      console.log('content preview (200 chars):', rc.content.substring(0, 200));
      // Check if LaTeX markers present
      const hasLatex = rc.content.includes('$') || rc.content.includes('\\frac') || rc.content.includes('\\sqrt');
      console.log('Contains LaTeX markers:', hasLatex);
    }
  } else {
    console.log('Response:', rcResp.data.substring(0, 300));
  }
  
  // Verify page image files exist on disk
  const paper = await prisma.examPaper.findFirst({ where: { sourceFormat: 'pdf' } });
  if (paper && paper.pageImages) {
    const imgs = JSON.parse(paper.pageImages);
    console.log('\nPage images in DB:', imgs.length);
    const fs = require('fs');
    const path = require('path');
    let existing = 0;
    for (const img of imgs.slice(0, 3)) {
      const fullPath = path.join(__dirname, img.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        console.log('  ', path.basename(fullPath), '-', Math.round(stat.size/1024) + 'KB');
        existing++;
      }
    }
    console.log('  ', existing, '/', Math.min(3, imgs.length), 'image files verified on disk');
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error('Error:', e.message));
