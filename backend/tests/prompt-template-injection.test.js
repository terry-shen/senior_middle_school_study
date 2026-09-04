/**
 * Test Prompt Template Injection
 */

const { PromptTemplateService } = require('../dist/services/prompt-template-service');
const service = new PromptTemplateService();

async function runTests() {
  console.log('=== Prompt Template Injection Tests ===\n');

  // Test 1: Get active template
  console.log('Test 1: Get active template for knowledge_identification');
  const template = await service.getActiveTemplate('knowledge_identification');
  if (template) {
    console.log('✓ Template found:', template.name, '- version:', template.version);
    console.log('  Has {{knowledge_points}}:', template.template.includes('{{knowledge_points}}'));
    console.log('  Has {{question}}:', template.template.includes('{{question}}'));
  } else {
    console.log('✗ Template not found');
  }

  // Test 2: Render template with variables
  console.log('\nTest 2: Render template with variables');
  const testTemplate = 'Hello {{name}}, your score is {{score}}.';
  const variables = { name: 'Alice', score: '95' };
  const rendered = service.renderTemplate(testTemplate, variables);
  console.log('  Input:', testTemplate);
  console.log('  Variables:', variables);
  console.log('  Output:', rendered);
  if (rendered === 'Hello Alice, your score is 95.') {
    console.log('✓ Render correct');
  } else {
    console.log('✗ Render incorrect');
  }

  // Test 3: Format knowledge points
  console.log('\nTest 3: Format knowledge points');
  const kps = [
    { name: '一元二次方程', description: 'ax²+bx+c=0形式的方程', parent: '代数' },
    { name: '配方法', description: '将方程化为完全平方形式', parent: '一元二次方程' },
  ];
  const formattedKps = service.formatKnowledgePoints(kps);
  console.log('  Output:', formattedKps);

  // Test 4: Format question content
  console.log('\nTest 4: Format question content');
  const question = {
    content: '解方程 x² - 5x + 6 = 0',
    type: '解答题',
    options: [],
  };
  const formattedQ = service.formatQuestionContent(question);
  console.log('  Output:', formattedQ);

  // Test 5: Build complete prompt
  console.log('\nTest 5: Build complete prompt for knowledge_identification');
  const fullPrompt = await service.buildPrompt('knowledge_identification', {
    question: {
      content: '已知二次函数y=x²-4x+3，求其对称轴方程。',
      type: '填空题',
    },
    knowledgePoints: [
      { name: '二次函数', description: 'y=ax²+bx+c形式的函数', parent: '函数' },
      { name: '对称轴', description: 'x=-b/(2a)', parent: '二次函数' },
    ],
  });
  
  if (fullPrompt) {
    console.log('✓ Full prompt built successfully');
    console.log('  Prompt length:', fullPrompt.length, 'characters');
    console.log('  Contains knowledge points:', fullPrompt.includes('二次函数'));
    console.log('  Contains question:', fullPrompt.includes('已知二次函数'));
    console.log('  No unreplaced placeholders:', !fullPrompt.includes('{{'));
  } else {
    console.log('✗ Failed to build prompt');
  }

  console.log('\n=== All tests completed ===');
}

runTests().catch(console.error);