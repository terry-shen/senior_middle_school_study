import prisma from './lib/prisma';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Try to create a test record
    const test = await prisma.testConnection.create({
      data: {
        message: 'Database connection successful!',
      },
    });
    
    console.log('✓ Database connection successful!');
    console.log('Test record created:', test);
    
    // Clean up test record
    await prisma.testConnection.delete({
      where: { id: test.id },
    });
    
    console.log('✓ Test record cleaned up');
    
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });