const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('=== Re-seeding database ===');
  
  // 1. Create classes
  const cls = await prisma.class.create({ data: { name: '高一(1)班', grade: '高一' } });
  console.log('Created class:', cls.id, cls.name);
  
  // 2. Create admin
  const admin = await prisma.student.create({
    data: {
      studentId: 'admin1',
      name: 'Admin',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      classId: cls.id,
    },
  });
  console.log('Created admin:', admin.id, admin.studentId);
  
  // 3. Create student
  const student = await prisma.student.create({
    data: {
      studentId: '2026001',
      name: '张三',
      passwordHash: hashPassword('student123'),
      role: 'student',
      classId: cls.id,
    },
  });
  console.log('Created student:', student.id, student.studentId);
  
  // 4. Create more students
  for (let i = 2; i <= 5; i++) {
    const s = await prisma.student.create({
      data: {
        studentId: `202600${i}`,
        name: `学生${i}`,
        passwordHash: hashPassword('student123'),
        role: 'student',
        classId: cls.id,
      },
    });
    console.log('Created student:', s.studentId);
  }
  
  console.log('\n=== Database re-seeded successfully ===');
  console.log('Admin: admin1 / admin123');
  console.log('Student: 2026001 / student123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
