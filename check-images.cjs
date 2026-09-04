const fs = require('fs');
const data = fs.readFileSync('mineru-parse-result.json','utf8').replace(/^\uFEFF/,'');
const parsed = JSON.parse(data);
const keys = Object.keys(parsed.results || {});
if (keys.length > 0) {
  const md = parsed.results[keys[0]].md_content || '';
  const imgRefs = md.match(/!\[\]\([^)]+\)/g) || [];
  console.log('Image references found:', imgRefs.length);
  imgRefs.slice(0, 5).forEach(r => console.log('  ', r));
  // Check if images were extracted to disk
  console.log('\nFirst 500 chars of markdown:');
  console.log(md.substring(0, 500));
}
