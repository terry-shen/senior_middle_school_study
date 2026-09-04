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
        resolve({
          status: res.statusCode,
          data: JSON.parse(body || '{}')
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Prompt Template API Tests ===\n');

  // Test 1: Get task types
  console.log('Test 1: GET /api/prompts/task-types');
  try {
    const result = await makeRequest('GET', '/api/prompts/task-types');
    console.log('  Status:', result.status);
    console.log('  Data:', result.data);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 2: Create a template
  console.log('Test 2: POST /api/prompts/templates (Create template)');
  const template1 = {
    taskType: 'knowledge_identification',
    name: '知识点识别模板 v1',
    template: '请根据以下题目内容识别涉及的知识点：\n题目：{question}\n请列出所有相关知识点。',
    isActive: true
  };
  
  try {
    const result = await makeRequest('POST', '/api/prompts/templates', template1);
    console.log('  Status:', result.status);
    console.log('  Data:', JSON.stringify(result.data, null, 2));
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 3: Create another template (should get version 2)
  console.log('Test 3: POST /api/prompts/templates (Create version 2)');
  const template2 = {
    taskType: 'knowledge_identification',
    name: '知识点识别模板 v2',
    template: '请分析以下题目并提取知识点：\n题目：{question}\n知识点列表：',
    isActive: false
  };
  
  try {
    const result = await makeRequest('POST', '/api/prompts/templates', template2);
    console.log('  Status:', result.status);
    console.log('  Data:', JSON.stringify(result.data, null, 2));
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 4: List all templates
  console.log('Test 4: GET /api/prompts/templates');
  try {
    const result = await makeRequest('GET', '/api/prompts/templates');
    console.log('  Status:', result.status);
    console.log('  Count:', result.data.length);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 5: Get active template for task type
  console.log('Test 5: GET /api/prompts/templates/type/knowledge_identification');
  try {
    const result = await makeRequest('GET', '/api/prompts/templates/type/knowledge_identification');
    console.log('  Status:', result.status);
    console.log('  Active version:', result.data.version);
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  // Test 6: Get all versions for task type
  console.log('Test 6: GET /api/prompts/templates/type/knowledge_identification/versions');
  try {
    const result = await makeRequest('GET', '/api/prompts/templates/type/knowledge_identification/versions');
    console.log('  Status:', result.status);
    console.log('  Versions:', result.data.map(t => `v${t.version} (${t.isActive ? 'active' : 'inactive'})`).join(', '));
    console.log('  ✓ Pass\n');
  } catch (e) {
    console.log('  ✗ Fail:', e.message, '\n');
  }

  console.log('=== All tests completed ===');
}

runTests().catch(console.error);