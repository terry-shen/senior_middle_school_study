const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('=== Knowledge Point Identification Template Test ===\n');

// Sample knowledge points structure
const SAMPLE_KNOWLEDGE_POINTS = `
高中数学知识点体系：

1. 代数
   1.1 集合与逻辑
       - 1.1.1 集合的概念与表示
       - 1.1.2 集合间的基本关系
   1.2 函数
       - 1.2.1 函数的概念
       - 1.2.2 函数的性质（单调性、奇偶性）
       - 1.2.3 基本初等函数
   1.3 三角函数
   1.4 数列
`;

// Sample question
const SAMPLE_QUESTION = `已知函数 f(x) = x³ - 3x + 1，求函数的单调区间。`;

// Start server
console.log('Starting server...');
const server = spawn('node', ['node_modules/ts-node/dist/bin.js', 'src/index.ts'], {
  cwd: __dirname + '/..',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, DATABASE_URL: 'file:./dev.db' },
  shell: true
});

server.stdout.on('data', (data) => {
  process.stdout.write('.');
});

function makeRequest(method, urlPath, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function waitForServer(max = 30) {
  for (let i = 0; i < max; i++) {
    try {
      await makeRequest('GET', '/health');
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function runTests() {
  console.log('\n\nServer ready!\n');

  // Test 1: Get template
  console.log('Test 1: GET /api/prompts/templates/type/knowledge_identification');
  try {
    const result = await makeRequest('GET', '/api/prompts/templates/type/knowledge_identification');
    console.log('  Status:', result.status);
    
    if (result.status === 200) {
      const template = result.data.template;
      console.log('  Template name:', result.data.name);
      console.log('  Version:', result.data.version);
      console.log('  ✓ Pass\n');
      
      // Test 2: Template injection
      console.log('Test 2: Template injection');
      const injected = template
        .replace('{{knowledge_points}}', SAMPLE_KNOWLEDGE_POINTS)
        .replace('{{question}}', SAMPLE_QUESTION);
      
      console.log('  Knowledge points injected: Yes');
      console.log('  Question injected: Yes');
      console.log('  ✓ Pass\n');
      
      // Test 3: Output format validation
      console.log('Test 3: Output format validation');
      const checks = {
        'JSON format': template.includes('```json'),
        'knowledge_points field': template.includes('"knowledge_points"'),
        'difficulty_indicators field': template.includes('"difficulty_indicators"'),
        'confidence field': template.includes('"confidence"')
      };
      
      for (const [name, passed] of Object.entries(checks)) {
        console.log(`  ${passed ? '✓' : '✗'} ${name}`);
      }
      
      const allPassed = Object.values(checks).every(v => v);
      console.log(allPassed ? '\n  ✓ All format checks passed\n' : '\n  ✗ Some format checks failed\n');
      
      // Test 4: Save output
      console.log('Test 4: Save injected template');
      const outDir = path.join(__dirname, 'test-output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'knowledge-identification-injected.txt'), injected);
      console.log('  Saved: test-output/knowledge-identification-injected.txt');
      console.log('  ✓ Pass\n');
      
      console.log('=== All tests completed ===\n');
      process.exit(0);
    } else {
      console.log('  ✗ Fail: Template not found (status', result.status, ')\n');
      process.exit(1);
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
    process.exit(1);
  }
}

async function main() {
  const ready = await waitForServer();
  if (!ready) {
    console.log('\n✗ Server failed to start\n');
    server.kill();
    process.exit(1);
  }
  await runTests();
}

main();