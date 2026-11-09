/**
 * 步骤 A：从数据库导出映射所需的原始数据（不修改任何数据）
 * 产物：data/netdisk-mapping/assets.jsonl + sections.json
 * 可反复执行。支持的参数：--include-manual（默认排除人工确认过的资源）
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const OUT_DIR = path.resolve(__dirname, '../../../data/netdisk-mapping');
const INCLUDE_MANUAL = process.argv.includes('--include-manual');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sections = await prisma.section.findMany({
    select: {
      id: true,
      title: true,
      chapter: { select: { id: true, title: true, textbook: { select: { id: true, name: true } } } },
    },
    orderBy: [{ chapter: { textbookId: 'asc' } }, { chapterId: 'asc' }, { order: 'asc' }],
  });
  fs.writeFileSync(
    path.join(OUT_DIR, 'sections.json'),
    JSON.stringify(sections, null, 1),
    'utf8',
  );

  const where = INCLUDE_MANUAL
    ? { status: { not: 'ignored' } }
    : { status: { not: 'ignored' }, mapSource: { not: 'manual' } };

  const file = path.join(OUT_DIR, 'assets.jsonl');
  const stream = fs.createWriteStream(file, 'utf8');
  const PAGE = 2000;
  let cursor = 0;
  let count = 0;
  for (;;) {
    const batch = await prisma.netdiskAsset.findMany({
      where: { ...where, id: { gt: cursor } },
      select: {
        id: true, name: true, path: true, ext: true, assetKind: true, audience: true,
        status: true, mapSource: true, mapConfirmed: true, sectionId: true,
      },
      orderBy: { id: 'asc' },
      take: PAGE,
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    for (const a of batch) stream.write(JSON.stringify(a) + '\n');
    count += batch.length;
    if (count % 20000 === 0) console.log('exported', count);
  }
  await new Promise((r) => stream.end(r));

  console.log(JSON.stringify({
    ok: true,
    includeManual: INCLUDE_MANUAL,
    sections: sections.length,
    assets: count,
    outDir: OUT_DIR,
  }, null, 1));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
