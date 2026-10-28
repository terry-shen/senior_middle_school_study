// test-persistent-api.cjs — spawn MinerU FastAPI detached, verify /file_parse end-to-end (pipeline backend)
// Usage: node test-persistent-api.cjs <input-file> [api-port]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const inputFile = process.argv[2];
const PORT = parseInt(process.argv[3] || '56090', 10);
const API = `http://127.0.0.1:${PORT}`;
const PY311 = 'C:/Users/Terry/AppData/Local/Programs/Python/Python311/python.exe';

function req(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
const get = (url) => req('GET', url, {});

function postFile(url, filePath, fields) {
  return new Promise((resolve, reject) => {
    const boundary = '----minerutest' + Date.now();
    const parts = [];
    for (const [k, v] of Object.entries(fields || {})) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, 'utf8'));
    }
    const fileData = fs.readFileSync(filePath);
    const fn = path.basename(filePath);
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${fn}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8'));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);
    req('POST', url, { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }, body).then(resolve, reject);
  });
}

(async () => {
  // 1. Spawn detached API if not healthy
  let health = await get(`${API}/health`).catch(() => null);
  console.log('Initial health:', health ? health.status : 'DOWN');
  if (!health || health.status !== 200) {
    const child = spawn(PY311, ['-m', 'mineru.cli.fast_api', '--host', '127.0.0.1', '--port', String(PORT)], {
      detached: true,
      stdio: ['ignore', fs.openSync(path.join(__dirname, 'uploads/papers/docx-debug2', 'fapi-persist.log'), 'a'), fs.openSync(path.join(__dirname, 'uploads/papers/docx-debug2', 'fapi-persist.err.log'), 'a')],
      windowsHide: true,
    });
    child.unref();
    console.log('Spawned API child PID', child.pid);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      health = await get(`${API}/health`).catch(() => null);
      if (health && health.status === 200) { console.log(`Healthy after ${(i + 1) * 3}s`); break; }
    }
  }
  if (!health || health.status !== 200) { console.error('API never became healthy'); process.exit(1); }

  // 2. Submit file parse with pipeline backend + images
  const t0 = Date.now();
  const body = await postFile(`${API}/file_parse`, inputFile, { backend: 'pipeline', return_md: 'true', return_images: 'true' });
  console.log(`file_parse status: ${body.status} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  let task;
  try { task = JSON.parse(body.body); } catch { console.log('raw body:', body.body.slice(0, 300)); process.exit(1); }
  console.log('task_id:', task.task_id, 'status:', task.status);

  // 3. Poll /tasks/{id} until completed/failed
  let t = task;
  for (let i = 0; i < 120 && t.status !== 'completed' && t.status !== 'failed'; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await get(`${API}/tasks/${t.task_id}`);
    t = JSON.parse(s.body);
    if (i % 10 === 0) console.log(`  poll ${i * 3}s: ${t.status}`);
  }
  console.log('final status:', t.status, `(${((Date.now() - t0) / 1000).toFixed(1)}s total)`);
  if (t.status === 'failed') { console.error('TASK FAILED:', t.error); process.exit(1); }

  // 4. Get result
  const result = await get(`${API}/tasks/${t.task_id}/result`);
  const parsed = JSON.parse(result.body);
  const keys = Object.keys(parsed);
  console.log('result keys:', keys.join(', '));
  const fileRes = parsed.results && parsed.results[0];
  if (fileRes) {
    console.log('file result keys:', Object.keys(fileRes).join(', '));
    const md = fileRes.md_content || fileRes.md || '';
    const latexCount = (md.match(/\$[^$]+\$/g) || []).length;
    console.log('md length:', md.length, '| LaTeX $...$ count:', latexCount);
    console.log('md preview:', md.slice(0, 300).replace(/\n/g, '\\n'));
    const imgs = fileRes.images || [];
    console.log('images:', imgs.length, JSON.stringify(imgs.slice(0, 3).map((im) => Object.fromEntries(Object.entries(im).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 40) : v])))));
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });