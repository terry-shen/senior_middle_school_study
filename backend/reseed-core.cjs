const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  // Create default LLM config (local Ollama)
  const llm = await prisma.lLMConfig.create({
    data: {
      name: 'Ollama qwen2.5-coder:7b',
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      modelName: 'qwen2.5-coder:7b',
      apiKey: '',
      isDefault: true,
      status: 'active',
      maxTokens: 4096,
      temperature: 0.7
    }
  });
  console.log('Created LLM config id=' + llm.id);

  // Create class
  const cls = await prisma.class.create({ data: { name: '高一(1)班', grade: '高一' } });

  // Admin user
  const ahash = await hashPassword('admin123');
  const admin = await prisma.student.create({
    data: { studentId: 'admin1', name: 'Admin', role: 'admin', passwordHash: ahash, classId: cls.id }
  });

  // Student user
  const shash = await hashPassword('student123');
  const stu = await prisma.student.create({
    data: { studentId: '2026001', name: '张三', role: 'student', passwordHash: shash, classId: cls.id }
  });

  console.log(`Created: LLM id=${llm.id}, admin id=${admin.id}, student id=${stu.id}, class id=${cls.id}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
