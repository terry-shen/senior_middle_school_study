const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createClass() {
  try {
    // Check if class already exists
    const existing = await prisma.class.findFirst();
    if (existing) {
      console.log('Class already exists:', existing);
      return existing;
    }
    
    const cls = await prisma.class.create({
      data: {
        name: '高一(1)班',
        grade: '高一'
      }
    });
    console.log('Created class:', cls);
    return cls;
  } finally {
    await prisma.$disconnect();
  }
}

createClass().catch(console.error);