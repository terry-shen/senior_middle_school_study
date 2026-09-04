const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

async function main() {
  const cls = await prisma.class.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '高一(1)班', grade: '高一' }
  });
  console.log('Class:', cls.name);

  const adminHash = await hashPassword('admin123');
  const admin = await prisma.student.upsert({
    where: { studentId: 'admin1' },
    update: { passwordHash: adminHash, role: 'admin', name: 'Admin' },
    create: { studentId: 'admin1', name: 'Admin', passwordHash: adminHash, classId: 1, role: 'admin' }
  });
  console.log('Admin:', admin.studentId, admin.role);

  const stuHash = await hashPassword('student123');
  const stu = await prisma.student.upsert({
    where: { studentId: '2026001' },
    update: { passwordHash: stuHash, role: 'student', name: '张三' },
    create: { studentId: '2026001', name: '张三', passwordHash: stuHash, classId: 1, role: 'student' }
  });
  console.log('Student:', stu.studentId, stu.role);
  console.log('Seed complete!');
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
