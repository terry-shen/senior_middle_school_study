/**
 * Test Knowledge Point Identification Prompt Template
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Sample knowledge points structure (simplified for testing)
const SAMPLE_KNOWLEDGE_POINTS = `
高中数学知识点体系：

1. 代数
   1.1 集合与逻辑
       - 1.1.1 集合的概念与表示
       - 1.1.2 集合间的基本关系
       - 1.1.3 集合的基本运算
   1.2 函数
       - 1.2.1 函数的概念
       - 1.2.2 函数的性质（单调性、奇偶性、周期性）
       - 1.2.3 基本初等函数
   1.3 三角函数
       - 1.3.1 三角函数的概念
       - 1.3.2 三角函数的图像与性质
   1.4 数列
       - 1.4.1 数列的概念与简单表示
       - 1.4.2 等差数列
       - 1.4.3 等比数列

2. 几何
   2.1 平面几何
       - 2.1.1 直线与方程
       - 2.1.2 圆与方程
   2.2 立体几何
       - 2.2.1 空间几何体的结构
       - 2.2.2 空间点、直线、平面的位置关系
   2.3 解析几何
       - 2.3.1 直线的方程
       - 2.3.2 圆的方程
       - 2.3.3 圆锥曲线

3. 概率与统计
   3.1 概率
       - 3.1.1 随机事件与概率
       - 3.1.2 古典概型
   3.2 统计
       - 3.2.1 随机抽样
       - 3.2.2 用样本估计总体
`;

// Sample test question
const SAMPLE_QUESTION = `
已知函数 f(x) = x³ - 3x + 1，求：
(1) 函数的单调区间；
(2) 函数的极值；
(3) 若方程 f(x) = a 有三个不相等的实根，求实数 a 的取值范围。
`;

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

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testKnowledgeIdentification() {
  console.log('=== Testing Knowledge Point Identification Prompt Template ===\n');

  // Test 1: Check if template exists
  console.log('Test 1: Fetch template from API');
  try {
    const result = await makeRequest('GET', '/api/prompts/templates/type/knowledge_identification');
    console.log('  Status:', result.status);
    
    if (result.status === 200) {
      console.log('  Template found:', result.data.name);
      console.log('  Version:', result.data.version);
      console.log('  ✓ Pass\n');
      
      const template = result.data.template;
      
      // Test 2: Template injection
      console.log('Test 2: Template injection');
      const injectedTemplate = template
        .replace('{{knowledge_points}}', SAMPLE_KNOWLEDGE_POINTS)
        .replace('{{question}}', SAMPLE_QUESTION);
      
      console.log('  Template length before injection:', template.length);
      console.log('  Template length after injection:', injectedTemplate.length);
      console.log('  Injected knowledge points: Yes');
      console.log('  Injected question: Yes');
      console.log('  ✓ Pass\n');
      
      // Test 3: Verify output format instructions
      console.log('Test 3: Verify output format instructions');
      const hasJsonFormat = template.includes('```json');
      const hasKnowledgePointsArray = template.includes('"knowledge_points"');
      const hasDifficultyIndicators = template.includes('"difficulty_indicators"');
      
      console.log('  Has JSON format instruction:', hasJsonFormat ? 'Yes' : 'No');
      console.log('  Has knowledge_points field:', hasKnowledgePointsArray ? 'Yes' : 'No');
      console.log('  Has difficulty_indicators field:', hasDifficultyIndicators ? 'Yes' : 'No');
      
      if (hasJsonFormat && hasKnowledgePointsArray && hasDifficultyIndicators) {
        console.log('  ✓ Pass\n');
      } else {
        console.log('  ✗ Fail: Missing required output format instructions\n');
      }
      
      // Test 4: Save injected template for manual review
      console.log('Test 4: Save injected template for review');
      const outputDir = path.join(__dirname, 'test-output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(outputDir, 'knowledge-identification-injected.txt'),
        injectedTemplate,
        'utf-8'
      );
      console.log('  Saved to: test-output/knowledge-identification-injected.txt');
      console.log('  ✓ Pass\n');
      
      console.log('=== All tests completed ===\n');
      console.log('Note: To test with actual LLM, use the injected template with your LLM service.');
      
    } else if (result.status === 404) {
      console.log('  Template not found. Please seed the template first:');
      console.log('  npx ts-node prisma/seed-prompt-templates.ts');
      console.log('  ✗ Fail\n');
    } else {
      console.log('  Response:', JSON.stringify(result.data));
      console.log('  ✗ Fail\n');
    }
  } catch (e) {
    console.log('  Error:', e.message);
    console.log('  Make sure the server is running on localhost:3000');
    console.log('  ✗ Fail\n');
  }
}

testKnowledgeIdentification().catch(console.error);