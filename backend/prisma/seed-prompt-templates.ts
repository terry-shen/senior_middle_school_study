/**
 * Seed Prompt Templates
 * Load default prompt templates into the database
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding prompt templates...');
  
  const templatesDir = path.join(__dirname, '..', 'seeders', 'prompt-templates');
  
  if (!fs.existsSync(templatesDir)) {
    console.log('Creating seeders/prompt-templates directory...');
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const templateData = JSON.parse(content);
    
    // Check if template with this taskType already exists
    const existing = await prisma.promptTemplate.findFirst({
      where: { taskType: templateData.taskType },
      orderBy: { version: 'desc' }
    });
    
    const version = existing ? existing.version + 1 : 1;
    
    // Deactivate other versions of the same taskType
    if (templateData.isActive) {
      await prisma.promptTemplate.updateMany({
        where: {
          taskType: templateData.taskType,
          isActive: true
        },
        data: { isActive: false }
      });
    }
    
    const template = await prisma.promptTemplate.create({
      data: {
        taskType: templateData.taskType,
        name: templateData.name,
        template: templateData.template,
        version,
        isActive: templateData.isActive ?? true
      }
    });
    
    console.log(`✓ Created: ${template.name} (v${template.version})`);
  }
  
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding prompt templates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });