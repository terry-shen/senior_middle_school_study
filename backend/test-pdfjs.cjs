// Test pdfjs-dist text extraction
const fs = require('fs');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  
  const data = new Uint8Array(fs.readFileSync('test-exam.pdf'));
  const doc = await pdfjs.getDocument({ data }).promise;
  
  console.log('Pages:', doc.numPages);
  
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    console.log(`Page ${i}:`, pageText.substring(0, 100));
    fullText += pageText + '\n';
  }
  
  console.log('\nFull text length:', fullText.length);
  console.log('Full text:', fullText);
}

main().catch(e => console.error('Error:', e.message));
