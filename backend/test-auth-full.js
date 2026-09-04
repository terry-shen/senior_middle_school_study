const { spawn } = require('child_process');
const http = require('http');

console.log('=== Starting server ===');

// Start server
const server = spawn('node', ['node_modules/ts-node/dist/bin.js', 'src/index.ts'], {
  cwd: __dirname.replace(/tests$/, ''),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, DATABASE_URL: 'file:./dev.db' },
  shell: true
});

let serverOutput = '';
server.stdout.on('data', (data) => {
  serverOutput += data.toString();
  console.log('[Server]', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('[Server Error]', data.toString().trim());
});

function makeRequest(method, path, data = null, token = null) {
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
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest('GET', '/health');
      console.log('\n✓ Server is ready!\n');
      return true;
    } catch (e) {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function runTests() {
  console.log('=== Auth API Tests ===\n');

  // Test 1: Register a new student
  console.log('Test 1: POST /api/auth/register');
  const registerData = {
    studentId: '2026001',
    name: '张三',
    password: 'password123',
    classId: 1
  };
  
  let token = null;
  try {
    const result = await makeRequest('POST', '/api/auth/register', registerData);
    console.log('  Status:', result.status);
    console.log('  Response:', JSON.stringify(result.data));
    if (result.status === 201 && result.data.success) {
      console.log('  ✓ Pass\n');
      token = result.data.token;
    } else {
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Duplicate registration
  console.log('Test 2: POST /api/auth/register (duplicate)');
  try {
    const result = await makeRequest('POST', '/api/auth/register', registerData);
    console.log('  Status:', result.status);
    if (result.status === 400 && result.data.error === '学号已存在') {
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Login
  console.log('Test 3: POST /api/auth/login');
  try {
    const result = await makeRequest('POST', '/api/auth/login', {
      studentId: '2026001',
      password: 'password123'
    });
    console.log('  Status:', result.status);
    if (result.status === 200 && result.data.success) {
      token = result.data.token;
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Get user info
  if (token) {
    console.log('Test 4: GET /api/auth/me');
    try {
      const result = await makeRequest('GET', '/api/auth/me', null, token);
      console.log('  Status:', result.status);
      if (result.status === 200) {
        console.log('  Student:', result.data.student?.name);
        console.log('  ✓ Pass\n');
      } else {
        console.log('  Response:', JSON.stringify(result.data));
      }
    } catch (e) {
      console.log('  ✗ Fail:', e.message, '\n');
    }

    // Test 5: Logout
    console.log('Test 5: POST /api/auth/logout');
    try {
      const result = await makeRequest('POST', '/api/auth/logout', null, token);
      console.log('  Status:', result.status);
      if (result.status === 200) {
        console.log('  ✓ Pass\n');
      } else {
        console.log('  Response:', JSON.stringify(result.data));
      }
    } catch (e) {
      console.log('  ✗ Fail:', e.message, '\n');
    }
  }

  console.log('=== Tests completed ===');
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