const http = require('http');
const { spawn } = require('child_process');

console.log('=== Starting server ===');

// Start server in background
const server = spawn('node', ['node_modules/ts-node/dist/bin.js', 'src/index.ts'], {
  cwd: __dirname,
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
  console.log('=== Student Batch Import Tests ===\n');

  // Test 1: Import students from JSON
  console.log('Test 1: POST /api/students/import/json');
  const students = [
    { studentId: 'S001', name: '李四', className: '一班', grade: '高一', password: 'password123' },
    { studentId: 'S002', name: '王五', className: '一班', grade: '高一' },
    { studentId: 'S003', name: '赵六', className: '二班', grade: '高一' }
  ];
  
  try {
    const result = await makeRequest('POST', '/api/students/import/json', { students });
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Success:', result.data.success);
      console.log('  Failed:', result.data.failed);
      console.log('  Created students:', result.data.createdStudents.map(s => s.name).join(', '));
      if (result.data.errors.length > 0) {
        console.log('  Errors:', result.data.errors);
      }
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Import students from CSV
  console.log('Test 2: POST /api/students/import/csv');
  const csvContent = `studentId,name,className,grade
S004,钱七,一班,高一
S005,孙八,二班,高一
S006,周九,三班,高一`;
  
  try {
    const result = await makeRequest('POST', '/api/students/import/csv', { csvContent });
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Success:', result.data.success);
      console.log('  Created students:', result.data.createdStudents.map(s => s.name).join(', '));
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: List students
  console.log('Test 3: GET /api/students');
  try {
    const result = await makeRequest('GET', '/api/students?limit=10');
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Total students:', result.data.pagination.total);
      console.log('  Students:', result.data.students.map(s => `${s.studentId}: ${s.name}`).slice(0, 5).join(', '));
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Get specific student
  console.log('Test 4: GET /api/students/:id');
  try {
    const result = await makeRequest('GET', '/api/students/1');
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  Student:', result.data.studentId, '-', result.data.name);
      console.log('  Class:', result.data.class?.name || 'No class');
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Export students to CSV
  console.log('Test 5: GET /api/students/export/csv');
  try {
    const result = await makeRequest('GET', '/api/students/export/csv');
    console.log('  Status:', result.status);
    if (result.status === 200) {
      const lines = result.data.split('\n');
      console.log('  Header:', lines[0]);
      console.log('  Sample rows:', lines.slice(1, 4).join(' | '));
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
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