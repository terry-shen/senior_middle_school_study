const fs = require('fs');
const extract = require('pdf-text-extract');

const buf = 'test-exam.pdf';
extract(buf, function(err, text) {
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log('Extracted text:', text.substring(0, 200));
  console.log('Text length:', text.length);
});
