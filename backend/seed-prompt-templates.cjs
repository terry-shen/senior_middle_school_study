// Re-seed prompt templates from seeders/prompt-templates/*.json
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const dir = path.join(__dirname, 'seeders', 'prompt-templates');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} template files`);

  let inserted = 0;
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    // Deactivate existing templates of same taskType
    await prisma.promptTemplate.updateMany({
      where: { taskType: data.taskType },
      data: { isActive: false },
    });
    // Insert new active template
    await prisma.promptTemplate.create({
      data: {
        name: data.name,
        taskType: data.taskType,
        template: data.template,
        isActive: true,
        version: 1,
      },
    });
    inserted++;
    console.log(`  ✓ ${data.taskType}: ${data.name}`);
  }

  console.log(`\nSeeded ${inserted} prompt templates.`);
  // Verify
  const count = await prisma.promptTemplate.count();
  const active = await prisma.promptTemplate.count({ where: { isActive: true } });
  console.log(`Total templates: ${count}, active: ${active}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
