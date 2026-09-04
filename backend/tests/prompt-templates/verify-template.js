const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTemplate() {
  try {
    const template = await prisma.promptTemplate.findFirst({
      where: {
        taskType: 'knowledge_identification',
        isActive: true
      },
      orderBy: { version: 'desc' }
    });
    
    if (!template) {
      console.log('❌ No active knowledge_identification template found');
      return false;
    }
    
    console.log('=== Template Found ===');
    console.log('Name:', template.name);
    console.log('Task Type:', template.taskType);
    console.log('Version:', template.version);
    console.log('Active:', template.isActive);
    console.log('\nTemplate preview (first 500 chars):');
    console.log(template.template.substring(0, 500) + '...');
    
    // Verify template structure
    console.log('\n=== Structure Verification ===');
    const checks = {
      'Has {{knowledge_points}} placeholder': template.template.includes('{{knowledge_points}}'),
      'Has {{question}} placeholder': template.template.includes('{{question}}'),
      'Has JSON output format': template.template.includes('```json'),
      'Has knowledge_points field': template.template.includes('"knowledge_points"'),
      'Has difficulty_indicators field': template.template.includes('"difficulty_indicators"'),
      'Has confidence field': template.template.includes('"confidence"')
    };
    
    let allPassed = true;
    for (const [name, passed] of Object.entries(checks)) {
      console.log(`${passed ? '✓' : '✗'} ${name}`);
      if (!passed) allPassed = false;
    }
    
    console.log('\n=== Test Result ===');
    if (allPassed) {
      console.log('✅ All checks passed - Template is ready');
      return true;
    } else {
      console.log('❌ Some checks failed');
      return false;
    }
  } catch (e) {
    console.log('Error:', e.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyTemplate().then(success => {
  process.exit(success ? 0 : 1);
});