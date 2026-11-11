/* 一次性：把云端网盘 OAuth 回调地址改成公网地址 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TARGET = 'http://106.15.136.254/api/netdisk/callback';

(async () => {
  const row = await prisma.netdiskConfig.findFirst();
  if (!row) {
    console.log('NO_CONFIG');
    return;
  }
  const updated = await prisma.netdiskConfig.update({
    where: { id: row.id },
    data: { redirectUri: TARGET },
  });
  console.log('STATE=' + updated.status);
  console.log('REDIRECT_URI=' + updated.redirectUri);
})()
  .catch((e) => {
    console.error('FAILED', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
