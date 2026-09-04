// Test with the real PDF file
const fs = require('fs');
const path = require('path');

async function main() {
  const pdfPath = path.join('D:', 'opencode', 'workspace', 'senior_middle_school', '2026年全国高考二卷数学卷真题及答案解析.pdf');
  console.log('File exists:', fs.existsSync(pdfPath));
  console.log('File size:', fs.statSync(pdfPath).size, 'bytes');
  
  // Try to extract text with pdfjs-dist
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
    console.log('PDF loaded! Pages:', doc.numPages);
  } catch(e) {
    console.error('Load error:', e.message);
    return;
  }
  
  let fullText = '';
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str || '').join(' ');
      console.log(`\n--- Page ${i} (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 300));
      fullText += pageText + '\n';
    } catch(e) {
      console.error(`Page ${i} error:`, e.message);
    }
  }
  
  console.log('\n=== Total text length:', fullText.length, '===');
  
  if (fullText.trim().length < 10) {
    console.log('\nWARNING: PDF appears to be image-based (scanned). Text extraction yielded no text.');
    console.log('This PDF needs OCR processing instead of text extraction.');
  }
  
  await doc.destroy();
}

main().catch(e => console.error('Fatal:', e.message));
