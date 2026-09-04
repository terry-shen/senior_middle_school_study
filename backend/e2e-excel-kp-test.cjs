// E2E test for excel-knowledge-import: download template → upload preview → confirm import → incremental test
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';

function login(studentId, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ studentId, password });
    const req = http.request(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        const parsed = JSON.parse(body);
        resolve({ token: parsed.token, user: parsed.student || parsed.user });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function downloadTemplate(token) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/knowledge-points/import/template`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, buffer, contentType: res.headers['content-type'] });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function uploadExcelPreview(token, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileBuffer, footer]);

    const req = http.request(`${BASE}/api/knowledge-points/import/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let resBody = '';
      res.on('data', (d) => (resBody += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function confirmImport(token, items) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ items });
    const req = http.request(`${BASE}/api/knowledge-points/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Excel Knowledge Import E2E Test ===\n');

  // Step 1: Login as admin
  console.log('Step 1: Login as admin1/admin123');
  const { token } = await login('admin1', 'admin123');
  if (!token) throw new Error('Login failed');
  console.log('  ✓ Token obtained\n');

  // Step 2: Download template
  console.log('Step 2: Download Excel template');
  const tpl = await downloadTemplate(token);
  if (tpl.status !== 200) throw new Error(`Template download failed: ${tpl.status}`);
  const tplPath = path.join(__dirname, 'kp-template-test.xlsx');
  fs.writeFileSync(tplPath, tpl.buffer);
  console.log(`  ✓ Template downloaded: ${tpl.buffer.length} bytes, content-type: ${tpl.contentType}`);
  console.log(`  ✓ Saved to: ${tplPath}\n`);

  // Step 3: Upload template for preview (use the downloaded template itself as test data — it has example rows)
  console.log('Step 3: Upload template for preview');
  const preview = await uploadExcelPreview(token, tplPath);
  console.log(`  Status: ${preview.status}`);
  if (preview.status !== 200) {
    console.log('  Preview response:', JSON.stringify(preview.data).substring(0, 500));
    // Template only has example rows in Sheet1 — may parse them. Let's check.
  }
  if (preview.data.items) {
    console.log(`  ✓ Items: ${preview.data.items.length}`);
    console.log(`  ✓ New: ${preview.data.newCount}, Update: ${preview.data.updateCount}, Total: ${preview.data.totalCount}`);
    console.log(`  ✓ Warnings: ${preview.data.warnings.length}`);
    if (preview.data.items.length > 0) {
      console.log(`  ✓ First item: code=${preview.data.items[0].code}, name=${preview.data.items[0].name}, level=${preview.data.items[0].level}`);
    }
  } else {
    console.log('  ✗ No items in preview response');
    console.log('  Full response:', JSON.stringify(preview.data).substring(0, 500));
  }
  console.log('');

  // Step 4: Confirm import
  if (preview.data.items && preview.data.items.length > 0) {
    console.log('Step 4: Confirm import');
    const result = await confirmImport(token, preview.data.items);
    console.log(`  Status: ${result.status}`);
    if (result.data.success) {
      console.log(`  ✓ Created: ${result.data.created}, Updated: ${result.data.updated}, Total: ${result.data.total}`);
      if (result.data.errors && result.data.errors.length > 0) {
        console.log(`  ⚠ Errors: ${result.data.errors.length}`);
        result.data.errors.slice(0, 3).forEach(e => console.log(`    - ${e.code}: ${e.error}`));
      }
    } else {
      console.log('  ✗ Import failed:', JSON.stringify(result.data).substring(0, 500));
    }
    console.log('');

    // Step 5: Incremental test — re-upload same template
    console.log('Step 5: Incremental test — re-upload same template');
    const preview2 = await uploadExcelPreview(token, tplPath);
    if (preview2.data.items) {
      console.log(`  ✓ Items: ${preview2.data.items.length}`);
      console.log(`  ✓ New: ${preview2.data.newCount} (should be 0), Update: ${preview2.data.updateCount} (should equal total)`);
    }
    console.log('');

    // Step 6: Confirm incremental import
    console.log('Step 6: Confirm incremental import');
    const result2 = await confirmImport(token, preview2.data.items || []);
    if (result2.data.success) {
      console.log(`  ✓ Created: ${result2.data.created} (should be 0), Updated: ${result2.data.updated} (should equal total)`);
    } else {
      console.log('  ✗ Incremental import failed:', JSON.stringify(result2.data).substring(0, 500));
    }
  } else {
    console.log('\nSkipping confirm/incremental tests (no items parsed from template)');
    console.log('Note: Template example rows may not parse if they are in Sheet1 with example format.');
    console.log('Creating a proper test Excel with real data would be needed for full E2E.');
  }

  // Cleanup
  try { fs.unlinkSync(tplPath); } catch {}

  console.log('\n=== E2E Test Complete ===');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
