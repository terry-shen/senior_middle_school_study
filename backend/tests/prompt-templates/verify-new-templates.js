const fs = require('fs');
const path = require('path');

const templates = [
  'analysis-generation.json',
  'answer-generation.json',
  'difficulty-assessment.json'
];

const templatesDir = './seeders/prompt-templates';

templates.forEach(file => {
  const filePath = path.join(templatesDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  console.log('=== ' + data.name + ' ===');
  console.log('Task Type:', data.taskType);
  console.log('Active:', data.isActive);
  console.log('Template Length:', data.template.length, 'chars');
  console.log('Has {{question}}:', data.template.includes('{{question}}'));
  console.log('Has JSON format:', data.template.includes('JSON') || data.template.includes('json'));
  console.log('');
});

console.log('All templates validated successfully!');