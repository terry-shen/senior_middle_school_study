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

async function runTests() {
  console.log('=== Permission Control Tests ===\n');

  // Setup: Create admin and student accounts
  console.log('Setup: Creating test accounts...\n');
  
  // Create admin
  let adminToken;
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      studentId: 'ADMIN001',
      name: '管理员测试',
      password: 'admin123',
      role: 'admin'
    });
    console.log('Admin created:', result.status);
    
    // Login as admin
    const loginResult = await makeRequest('POST', '/api/auth/login', {
      studentId: 'ADMIN001',
      password: 'admin123'
    });
    adminToken = loginResult.data.token;
    console.log('Admin token obtained\n');
  } catch (e) {
    console.log('Admin setup failed:', e.message, '\n');
  }

  // Create student
  let studentToken, studentId;
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      studentId: 'STUDENT001',
      name: '学生测试',
      password: 'student123',
      role: 'student'
    });
    console.log('Student created:', result.status);
    studentId = result.data.student.id;  // Fix: access student.id
    
    // Login as student
    const loginResult = await makeRequest('POST', '/api/auth/login', {
      studentId: 'STUDENT001',
      password: 'student123'
    });
    studentToken = loginResult.data.token;
    console.log('Student token obtained\n');
  } catch (e) {
    console.log('Student setup failed:', e.message, '\n');
  }

  // Test 1: Access protected route without token
  console.log('Test 1: Access protected route without token');
  try {
    const result = await makeRequest('GET', '/api/students');
    console.log('  Status:', result.status);
    if (result.status === 401) {
      console.log('  ✓ Correctly rejected unauthenticated request\n');
    } else {
      console.log('  ✗ Should have rejected\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Admin can list all students
  console.log('Test 2: Admin accesses /api/students (should succeed)');
  try {
    const result = await makeRequest('GET', '/api/students', null, adminToken);
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  ✓ Admin can list students\n');
    } else {
      console.log('  ✗ Failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Student cannot list all students (admin only)
  console.log('Test 3: Student tries /api/students (should fail)');
  try {
    const result = await makeRequest('GET', '/api/students', null, studentToken);
    console.log('  Status:', result.status);
    if (result.status === 403) {
      console.log('  ✓ Correctly denied student access\n');
    } else {
      console.log('  ✗ Should have denied, got:', result.status, '\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Student can view their own profile
  console.log('Test 4: Student views own profile (should succeed)');
  try {
    const result = await makeRequest('GET', `/api/students/${studentId}`, null, studentToken);
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  ✓ Student can view own profile\n');
    } else {
      console.log('  ✗ Failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Student cannot view other student's profile
  console.log('Test 5: Student tries to view other student (should fail)');
  try {
    const result = await makeRequest('GET', '/api/students/1', null, studentToken);
    console.log('  Status:', result.status);
    if (result.status === 403) {
      console.log('  ✓ Correctly denied access to other student\n');
    } else {
      console.log('  ✗ Should have denied\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 6: Admin can view any student
  console.log('Test 6: Admin views any student profile (should succeed)');
  try {
    const result = await makeRequest('GET', `/api/students/${studentId}`, null, adminToken);
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  ✓ Admin can view any student\n');
    } else {
      console.log('  ✗ Failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 7: Admin can create classes
  console.log('Test 7: Admin creates class (should succeed)');
  try {
    const result = await makeRequest('POST', '/api/classes', {
      name: '权限测试班',
      grade: '高一'
    }, adminToken);
    console.log('  Status:', result.status);
    if (result.status === 201) {
      console.log('  ✓ Admin can create class\n');
    } else {
      console.log('  ✗ Failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 8: Student cannot create classes
  console.log('Test 8: Student tries to create class (should fail)');
  try {
    const result = await makeRequest('POST', '/api/classes', {
      name: '非法班级',
      grade: '高一'
    }, studentToken);
    console.log('  Status:', result.status);
    if (result.status === 403) {
      console.log('  ✓ Correctly denied class creation\n');
    } else {
      console.log('  ✗ Should have denied\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 9: Admin can import students
  console.log('Test 9: Admin imports students (should succeed)');
  try {
    const result = await makeRequest('POST', '/api/students/import/json', {
      students: [{
        studentId: 'IMPORT001',
        name: '导入学生',
        className: '临时班',
        grade: '高一',
        defaultPassword: 'password123'
      }]
    }, adminToken);
    console.log('  Status:', result.status);
    if (result.status === 200) {
      console.log('  ✓ Admin can import students\n');
    } else {
      console.log('  ✗ Failed\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 10: Student cannot import students
  console.log('Test 10: Student tries to import (should fail)');
  try {
    const result = await makeRequest('POST', '/api/students/import/json', {
      students: [{
        studentId: 'ILLEGAL001',
        name: '非法导入',
        className: '临时班',
        grade: '高一',
        defaultPassword: 'password123'
      }]
    }, studentToken);
    console.log('  Status:', result.status);
    if (result.status === 403) {
      console.log('  ✓ Correctly denied import\n');
    } else {
      console.log('  ✗ Should have denied\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All permission tests completed ===');
}

runTests().catch(console.error);