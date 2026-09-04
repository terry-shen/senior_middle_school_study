const fs = require('fs');
const pdfParse = require('pdf-parse');

const buf = fs.readFileSync('test-exam.pdf');
console.log('pdfParse type:', typeof pdfParse);
console.log('pdfParse keys:', Object.keys(pdfParse));

// Try calling it as a function
try {
  pdfParse(buf).then(data => {
    console.log('SUCCESS! Text:', data.text?.substring(0, 200));
    console.log('Pages:', data.numpages);
  }).catch(e => console.error('Error:', e.message));
} catch(e) {
  console.log('Direct call failed, trying PDFParse class');
  const { PDFParse } = pdfParse;
  const p = new PDFParse(buf);
  try {
    const data = p.getTextContent ? p.getTextContent() : p;
    console.log('Data:', data);
  } catch(e2) {
    console.error('PDFParse failed:', e2.message);
  }
}
