/**
 * 学习资源去重：按「规范化文件名 + 文件大小 + 学科」判定为同一文件
 * 保留优先级：已挂章节 > 学生可见 > 已确认 > id 小
 * 其余标记 status='ignored'（不物理删除，可恢复）
 * 用法：node dedup-assets.cjs           # dry-run 只统计
 *      node dedup-assets.cjs --apply   # 实际写库
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[（(]\s*\d+\s*[）)]/g, '')   // (1) 副本编号
    .replace(/\s*-\s*副本/g, '')
    .trim();
}

function subjectOf(path) {
  const pairs = [
    ['数学', 'math'], ['物理', 'physics'], ['化学', 'chemistry'], ['生物', 'biology'],
    ['语文', 'chinese'], ['英语', 'english'], ['政治', 'politics'], ['历史', 'history'], ['地理', 'geography'],
  ];
  let best = null;
  for (const [word, code] of pairs) {
    const i = path.lastIndexOf(word);
    if (i >= 0 && (!best || i > best.i)) best = { i, code };
  }
  return best ? best.code : 'unknown';
}

(async () => {
  const rows = await prisma.netdiskAsset.findMany({
    where: { status: { not: 'ignored' }, assetKind: { not: 'junk' } },
    select: {
      id: true, name: true, size: true, path: true, assetKind: true,
      sectionId: true, mapConfirmed: true, audience: true, candidateSections: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log('scanned', rows.length);

  const groups = new Map();
  for (const r of rows) {
    const size = r.size != null ? String(r.size) : '0';
    if (size === '0') continue; // 无大小信息不参与去重，避免误伤
    const key = `${subjectOf(r.path)}|${normalizeName(r.name)}|${size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  let dupFiles = 0;
  const plan = [];
  const byKind = {};
  for (const g of dupGroups) {
    const sorted = [...g].sort((a, b) => {
      const score = (x) => (x.sectionId ? 4 : 0) + (x.mapConfirmed ? 2 : 0) + (x.audience === 'student' || x.audience === 'both' ? 1 : 0);
      return score(b) - score(a) || a.id - b.id;
    });
    const keep = sorted[0];
    const drop = sorted.slice(1);
    plan.push({ keep: keep.id, drop: drop.map((x) => x.id), name: keep.name, size: String(keep.size), kind: keep.assetKind, count: drop.length });
    dupFiles += drop.length;
    byKind[keep.assetKind] = (byKind[keep.assetKind] || 0) + drop.length;
  }

  console.log(JSON.stringify({
    total: rows.length,
    duplicateGroups: dupGroups.length,
    duplicateFiles: dupFiles,
    byKind,
    samples: plan.slice(0, 10).map((p) => `${p.name} (${p.kind}, ${p.size}B) x${p.count + 1} keep=${p.keep}`),
  }, null, 1));

  if (!APPLY) {
    console.log('\n(dry-run) 加 --apply 才会写库');
    await prisma.$disconnect();
    return;
  }

  let applied = 0;
  for (let i = 0; i < plan.length; i += 200) {
    const chunk = plan.slice(i, i + 200);
    const ids = chunk.flatMap((p) => p.drop);
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { status: 'ignored' } });
    applied += ids.length;
  }
  const remaining = await prisma.netdiskAsset.count({ where: { status: 'active' } });
  console.log(`\napplied ignored=${applied}, activeRemaining=${remaining}`);
  await prisma.$disconnect();
})();
