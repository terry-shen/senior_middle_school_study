// 学科字典种子脚本 — 幂等（upsert by code）
// 预置学科：语文/数学/英语/物理/化学/生物/政治/历史/地理/文综/理综
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SUBJECTS = [
  { code: 'chinese',      name: '语文', icon: '📖', color: '#ef4444', order: 1 },
  { code: 'math',         name: '数学', icon: '🔢', color: '#3b82f6', order: 2 },
  { code: 'english',      name: '英语', icon: '🔤', color: '#10b981', order: 3 },
  { code: 'physics',      name: '物理', icon: '⚛️', color: '#8b5cf6', order: 4 },
  { code: 'chemistry',    name: '化学', icon: '🧪', color: '#f59e0b', order: 5 },
  { code: 'biology',      name: '生物', icon: '🧬', color: '#22c55e', order: 6 },
  { code: 'politics',     name: '政治', icon: '⚖️', color: '#64748b', order: 7 },
  { code: 'history',      name: '历史', icon: '📜', color: '#a16207', order: 8 },
  { code: 'geography',    name: '地理', icon: '🌍', color: '#0ea5e9', order: 9 },
  { code: 'liberal_arts', name: '文综', icon: '📚', color: '#dc2626', order: 10 },
  { code: 'science',      name: '理综', icon: '🔬', color: '#7c3aed', order: 11 },
];

async function main() {
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, icon: s.icon, color: s.color, order: s.order },
      create: { ...s, isActive: true },
    });
  }
  const count = await prisma.subject.count();
  console.log(`Seeded ${SUBJECTS.length} subjects, total in DB: ${count}`);
  const math = await prisma.subject.findUnique({ where: { code: 'math' } });
  console.log(`math subject id = ${math.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
