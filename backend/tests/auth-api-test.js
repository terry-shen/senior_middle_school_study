const http = require('http');

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
    console.log('  Success:', result.data.success);
    if (result.data.success) {
      console.log('  Student:', result.data.student?.name, `(${result.data.student?.studentId})`);
      console.log('  Token received:', result.data.token ? 'Yes' : 'No');
      token = result.data.token;
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Error:', result.data.error);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Try to register with same studentId (should fail)
  console.log('Test 2: POST /api/auth/register (duplicate studentId)');
  try {
    const result = await makeRequest('POST', '/api/auth/register', registerData);
    console.log('  Status:', result.status);
    console.log('  Success:', result.data.success);
    if (!result.data.success && result.data.error === '学号已存在') {
      console.log('  Error message correct: ✓');
      console.log('  ✓ Pass\n');
    } else {
      console.log('  ✗ Fail: Expected error\n');
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
    console.log('  Success:', result.data.success);
    if (result.data.success) {
      console.log('  Student:', result.data.student?.name);
      token = result.data.token;
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Error:', result.data.error);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Login with wrong password
  console.log('Test 4: POST /api/auth/login (wrong password)');
  try {
    const result = await makeRequest('POST', '/api/auth/login', {
      studentId: '2026001',
      password: 'wrongpassword'
    });
    console.log('  Status:', result.status);
    console.log('  Success:', result.data.success);
    if (!result.data.success) {
      console.log('  Error:', result.data.error);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  ✗ Fail: Should have failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Get current user info
  console.log('Test 5: GET /api/auth/me');
  try {
    const result = await makeRequest('GET', '/api/auth/me', null, token);
    console.log('  Status:', result.status);
    console.log('  Success:', result.data.success);
    if (result.data.success) {
      console.log('  Student:', result.data.student?.name, `(${result.data.student?.studentId})`);
      console.log('  ✓ Pass\n');
    } else {
      console.log('  Error:', result.data.error);
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 6: Logout
  console.log('Test 6: POST /api/auth/logout');
  try {
    const result = await makeRequest('POST', '/api/auth/logout', null, token);
    console.log('  Status:', result.status);
    console.log('  Success:', result.data.success);
    console.log('  Message:', result.data.message);
    if (result.data.success) {
      console.log('  ✓ Pass\n');
    } else {
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 7: Try to use old token
  console.log('Test 7: GET /api/auth/me (after logout)');
  try {
    const result = await makeRequest('GET', '/api/auth/me', null, token);
    console.log('  Status:', result.status);
    if (result.status === 401) {
      console.log('  Error:', result.data.error);
      console.log('  ✓ Pass: Token invalidated\n');
    } else {
      console.log('  ✗ Fail: Should have returned 401\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All tests completed ===');
}

runTests().catch(console.error);