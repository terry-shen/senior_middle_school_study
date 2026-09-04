const http = require('http');

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

async function runTests() {
  console.log('=== Student CRUD API Tests ===\n');

  // Test 1: Create a new student via JSON import
  console.log('Test 1: POST /api/students/import/json (Create)');
  const newStudent = {
    students: [
      {
        studentId: 'TEST001',
        name: '测试学生',
        className: '测试班',
        grade: '高一',
        defaultPassword: 'password123'
      }
    ]
  };
  
  try {
    const result = await makeRequest('POST', '/api/students/import/json', newStudent);
    console.log('  Status:', result.status);
    if (result.status === 200 && result.data.success === 1) {
      console.log('  ✓ Created student:', result.data.created[0].name);
    } else {
      console.log('  Response:', JSON.stringify(result.data));
    }
    console.log();
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: List students
  console.log('Test 2: GET /api/students (List)');
  let studentId;
  try {
    const result = await makeRequest('GET', '/api/students');
    console.log('  Status:', result.status);
    console.log('  Total students:', result.data.pagination.total);
    if (result.data.students.length > 0) {
      studentId = result.data.students[result.data.students.length - 1].id;
      console.log('  Last student ID:', studentId);
    }
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Get specific student
  console.log('Test 3: GET /api/students/' + studentId + ' (Read)');
  try {
    const result = await makeRequest('GET', `/api/students/${studentId}`);
    console.log('  Status:', result.status);
    console.log('  Student:', result.data.studentId, '-', result.data.name);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Update student
  console.log('Test 4: PUT /api/students/' + studentId + ' (Update)');
  try {
    const result = await makeRequest('PUT', `/api/students/${studentId}`, {
      name: '测试学生_已修改'
    });
    console.log('  Status:', result.status);
    console.log('  Updated name:', result.data.name);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Verify update
  console.log('Test 5: GET /api/students/' + studentId + ' (Verify Update)');
  try {
    const result = await makeRequest('GET', `/api/students/${studentId}`);
    console.log('  Status:', result.status);
    if (result.data.name === '测试学生_已修改') {
      console.log('  ✓ Name updated correctly\n');
    } else {
      console.log('  ✗ Name not updated\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 6: Delete student
  console.log('Test 6: DELETE /api/students/' + studentId + ' (Delete)');
  try {
    const result = await makeRequest('DELETE', `/api/students/${studentId}`);
    console.log('  Status:', result.status);
    console.log('  Message:', result.data.message);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 7: Verify deletion
  console.log('Test 7: GET /api/students/' + studentId + ' (Verify Deletion)');
  try {
    const result = await makeRequest('GET', `/api/students/${studentId}`);
    console.log('  Status:', result.status);
    if (result.status === 404) {
      console.log('  ✓ Student deleted successfully\n');
    } else {
      console.log('  ✗ Student still exists\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All CRUD tests completed ===');
}

runTests().catch(console.error);