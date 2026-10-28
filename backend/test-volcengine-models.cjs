const https = require('https');

const BASE = 'https://st8tp3ajl0df3n8b8l8qu.apigateway-cn-beijing.volceapi.com/v1';
const KEY = '04d34a78-c95d-44ae-99b4-dba069f32c35';

const MODELS = [
  'deepseek-v4.1-flash', 'deepseek-v4-flash', 'deepseek-v4-pro',
  'doubao-seed-2.1-pro', 'glm-5.2', 'glm-5.3', 'glm-5.3-flash', 'hy3',
  'kimi-k2.7-code', 'kimi-k3', 'MiniMax-M3', 'qwen3.7-max', 'qwen3.7-plus',
  'qwen3.8-flash', 'qwen3.8-max', 'tencent/kimi-k3',
  'volcengine/deepseek-v4.1-flash', 'zhipu/glm-5.3',
];

function post(path, body, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + path);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: timeoutMs,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve({ status: res.statusCode, raw }));
    });
    req.on('error', (e) => resolve({ status: 0, raw: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, raw: 'TIMEOUT' }); });
    req.write(data);
    req.end();
  });
}

function extractText(raw) {
  try {
    const j = JSON.parse(raw);
    if (j.choices && j.choices[0]) {
      const m = j.choices[0].message || {};
      return (m.content || m.reasoning_content || '').trim();
    }
    return 'ERR:' + (j.error ? (j.error.message || JSON.stringify(j.error)) : raw.slice(0, 200));
  } catch {
    return 'PARSE_ERR:' + raw.slice(0, 200);
  }
}

(async () => {
  const results = [];
  // sequential to avoid rate limits
  for (const m of MODELS) {
    const t0 = Date.now();
    const r = await post('/chat/completions', {
      model: m,
      messages: [{ role: 'user', content: '用一句话说明二次函数的定义。' }],
      max_tokens: 512,
      temperature: 0.3,
    });
    const ms = Date.now() - t0;
    const text = extractText(r.raw);
    const ok = r.status === 200 && !text.startsWith('ERR') && !text.startsWith('PARSE_ERR');
    results.push({ model: m, status: r.status, ms, ok, preview: text.slice(0, 90).replace(/\n/g, ' ') });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(r.status).padEnd(4)} ${String(ms).padStart(6)}ms  ${m.padEnd(32)} ${ok ? text.slice(0, 70).replace(/\n/g, ' ') : text.slice(0, 120).replace(/\n/g, ' ')}`);
  }
  console.log('\n=== SUMMARY ===');
  console.log('PASS:', results.filter(r => r.ok).map(r => r.model).join(', '));
  console.log('FAIL:', results.filter(r => !r.ok).map(r => `${r.model}(${r.status})`).join(', '));
})();
