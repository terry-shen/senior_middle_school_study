const { exec } = require('child_process');
const http = require('http');

// Start server
const server = exec('node dist/index.js', {
  cwd: __dirname,
  env: { ...process.env, DATABASE_URL: 'file:./dev.db' }
});

server.stdout.on('data', (data) => {
  console.log('[Server]', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('[Server Error]', data.toString().trim());
});

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : {}
          });
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

async function waitForServer(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest('GET', '/health');
      console.log('\n✓ Server ready!\n');
      return true;
    } catch (e) {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function runTests() {
  console.log('=== Knowledge Point API Tests ===\n');

  // Use random code to avoid duplicates
  const randomSuffix = Date.now();
  
  // Test 1: Create root knowledge point
  console.log('Test 1: POST /api/knowledge-points (Create root)');
  try {
    const result = await makeRequest('POST', '/api/knowledge-points', {
      code: `KP-${randomSuffix}`,
      name: '函数的概念',
      level: 1,
      description: '函数的基本概念和定义'
    });
    console.log('  Status:', result.status);
    if (result.status === 201) {
      console.log('  Created:', result.data.name, '- ID:', result.data.id);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', result.data);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Create child knowledge point
  console.log('Test 2: POST /api/knowledge-points (Create child)');
  try {
    const result = await makeRequest('POST', '/api/knowledge-points', {
      code: `KP-${randomSuffix}-1`,
      name: '函数的定义域',
      level: 2,
      parentId: 1,
      masteryLevel: 'intermediate'
    });
    console.log('  Status:', result.status);
    if (result.status === 201) {
      console.log('  Created:', result.data.name, '- parent:', result.data.parentId);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', result.data);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Get tree structure
  console.log('Test 3: GET /api/knowledge-points/tree/full');
  try {
    const result = await makeRequest('GET', '/api/knowledge-points/tree/full');
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Tree nodes:', result.data.length);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', result.data);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Get ancestors
  console.log('Test 4: GET /api/knowledge-points/2/ancestors');
  try {
    const result = await makeRequest('GET', '/api/knowledge-points/2/ancestors');
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Ancestors:', result.data.length);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', result.data);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All tests completed ===\n');
}

async function main() {
  const ready = await waitForServer();
  if (!ready) {
    console.log('\n✗ Server failed to start\n');
    server.kill();
    process.exit(1);
  }

  await runTests();
  console.log('Cleaning up...');
  server.kill();
  process.exit(0);
}

main();