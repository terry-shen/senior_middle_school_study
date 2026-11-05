const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // Find all published/ongoing/graded exam sessions
  const sessions = await prisma.examSession.findMany({
    where: { status: { in: ['published', 'ongoing', 'graded'] } },
    select: { id: true, title: true, status: true },
  });
  console.log('published/ongoing/graded sessions:', sessions.length);

  // Get all students
  const students = await prisma.student.findMany({
    where: { role: 'student' },
    select: { id: true, classId: true },
  });
  console.log('students:', students.length);

  // For each session, create assignments for all students (idempotent)
  let created = 0, skipped = 0;
  for (const session of sessions) {
    for (const student of students) {
      try {
        await prisma.examSessionAssignment.create({
          data: { examSessionId: session.id, studentId: student.id, classId: student.classId },
        });
        created++;
      } catch (e) {
        if (e.code === 'P2002') skipped++; // unique constraint = already exists
        else throw e;
      }
    }
  }
  console.log(`Migration: ${created} assignments created, ${skipped} skipped`);
  await prisma.$disconnect();
})();