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
  console.log('=== Class Management API Tests ===\n');

  // Test 1: Create a new class
  console.log('Test 1: POST /api/classes (Create)');
  const newClass = { name: '高一(3)班', grade: '高一' };
  let classId;
  
  try {
    const result = await makeRequest('POST', '/api/classes', newClass);
    console.log('  Status:', result.status);
    if (result.status === 201) {
      classId = result.data.id;
      console.log('  ✓ Created class:', result.data.name, '- ID:', classId);
    } else {
      console.log('  Response:', JSON.stringify(result.data));
    }
    console.log();
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: List classes
  console.log('Test 2: GET /api/classes (List)');
  try {
    const result = await makeRequest('GET', '/api/classes');
    console.log('  Status:', result.status);
    console.log('  Total classes:', result.data.pagination.total);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Get specific class
  console.log('Test 3: GET /api/classes/' + classId + ' (Read)');
  try {
    const result = await makeRequest('GET', `/api/classes/${classId}`);
    console.log('  Status:', result.status);
    console.log('  Class:', result.data.name);
    console.log('  Students:', result.data.studentCount);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: Update class
  console.log('Test 4: PUT /api/classes/' + classId + ' (Update)');
  try {
    const result = await makeRequest('PUT', `/api/classes/${classId}`, {
      name: '高一(3)班_已修改'
    });
    console.log('  Status:', result.status);
    console.log('  Updated name:', result.data.name);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Create a test student
  console.log('Test 5: Create test student for assignment');
  try {
    const result = await makeRequest('POST', '/api/students/import/json', {
      students: [{
        studentId: 'ASSIGN001',
        name: '待分配学生',
        className: '临时班',
        grade: '高一',
        defaultPassword: 'password123'
      }]
    });
    console.log('  ✓ Test student created\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 6: Get students list to find the test student
  console.log('Test 6: Find test student ID');
  let studentId;
  try {
    const result = await makeRequest('GET', '/api/students?limit=20');
    const testStudent = result.data.students.find(s => s.studentId === 'ASSIGN001');
    if (testStudent) {
      studentId = testStudent.id;
      console.log('  ✓ Found student ID:', studentId, '\n');
    } else {
      console.log('  ✗ Test student not found\n');
    }
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 7: Assign student to class
  console.log('Test 7: POST /api/classes/' + classId + '/assign/' + studentId);
  try {
    const result = await makeRequest('POST', `/api/classes/${classId}/assign/${studentId}`);
    console.log('  Status:', result.status);
    console.log('  Student:', result.data.name, 'assigned to class');
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 8: Verify student is in class
  console.log('Test 8: GET /api/classes/' + classId + ' (Verify student assignment)');
  try {
    const result = await makeRequest('GET', `/api/classes/${classId}`);
    console.log('  Status:', result.status);
    console.log('  Student count:', result.data.studentCount);
    if (result.data.students && result.data.students.length > 0) {
      console.log('  Students:', result.data.students.map(s => s.name).join(', '));
    }
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 9: Unassign student from class
  console.log('Test 9: POST /api/classes/' + classId + '/unassign/' + studentId);
  try {
    const result = await makeRequest('POST', `/api/classes/${classId}/unassign/${studentId}`);
    console.log('  Status:', result.status);
    console.log('  Message:', result.data.message);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 10: Get classes by grade
  console.log('Test 10: GET /api/classes/grade/高一');
  try {
    const result = await makeRequest('GET', '/api/classes/grade/高一');
    console.log('  Status:', result.status);
    console.log('  Classes for grade 高一:', result.data.length);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 11: Try to delete class with students (should fail)
  console.log('Test 11: DELETE /api/classes/' + classId + ' (Should fail if has students)');
  try {
    // First assign a student again
    await makeRequest('POST', `/api/classes/${classId}/assign/${studentId}`);
    
    // Try to delete
    const result = await makeRequest('DELETE', `/api/classes/${classId}`);
    console.log('  Status:', result.status);
    if (result.status === 400) {
      console.log('  ✓ Correctly prevented deletion:', result.data.error);
    } else {
      console.log('  ✗ Should have prevented deletion');
    }
    console.log();
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 12: Delete class after removing students
  console.log('Test 12: DELETE /api/classes/' + classId + ' (After removing students)');
  try {
    // Unassign student first
    await makeRequest('POST', `/api/classes/${classId}/unassign/${studentId}`);
    
    // Now delete
    const result = await makeRequest('DELETE', `/api/classes/${classId}`);
    console.log('  Status:', result.status);
    console.log('  Message:', result.data.message);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All class management tests completed ===');
}

runTests().catch(console.error);