// 学科维度迁移脚本 — 幂等
// 1. ExamPaper.subjectLegacy(String) → Subject code 映射 → subjectId（无法映射兜底数学）
// 2. Question/ExamSession/StudentWrongQuestion/KnowledgePoint subjectId null → 数学 ID
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 中文名/别名 → Subject.code
const ALIASES = {
  '数学': 'math', 'math': 'math',
  '语文': 'chinese', 'chinese': 'chinese',
  '英语': 'english', 'english': 'english',
  '物理': 'physics', 'physics': 'physics',
  '化学': 'chemistry', 'chemistry': 'chemistry',
  '生物': 'biology', 'biology': 'biology',
  '政治': 'politics', 'politics': 'politics',
  '历史': 'history', 'history': 'history',
  '地理': 'geography', 'geography': 'geography',
  '文综': 'liberal_arts', '文科综合': 'liberal_arts', 'liberal_arts': 'liberal_arts',
  '理综': 'science', '理科综合': 'science', 'science': 'science',
};

async function main() {
  const subjects = await prisma.subject.findMany();
  const byCode = new Map(subjects.map((s) => [s.code, s.id]));
  const mathId = byCode.get('math');
  console.log(`subjects=${subjects.length}, mathId=${mathId}`);
  if (!mathId) throw new Error('math subject missing — run seed-subjects.cjs first');

  // 1. ExamPaper: subjectLegacy → subjectId
  const papers = await prisma.examPaper.findMany({ select: { id: true, subjectLegacy: true, subjectId: true } });
  let mapped = 0, fellBack = 0, already = 0;
  for (const p of papers) {
    if (p.subjectId != null) { already++; continue; }
    const code = p.subjectLegacy ? ALIASES[String(p.subjectLegacy).trim()] : undefined;
    const targetId = code ? byCode.get(code) : undefined;
    if (targetId) { mapped++; } else { fellBack++; }
    await prisma.examPaper.update({ where: { id: p.id }, data: { subjectId: targetId || mathId } });
  }
  console.log(`ExamPaper: total=${papers.length}, mapped=${mapped}, fallbackMath=${fellBack}, alreadySet=${already}`);

  // 2. 其他表 null subjectId → math
  for (const [model, label] of [
    [prisma.question, 'Question'],
    [prisma.examSession, 'ExamSession'],
    [prisma.studentWrongQuestion, 'StudentWrongQuestion'],
    [prisma.knowledgePoint, 'KnowledgePoint'],
  ]) {
    const r = await model.updateMany({ where: { subjectId: null }, data: { subjectId: mathId } });
    console.log(`${label}: filled ${r.count} nulls → math`);
  }

  // 3. 验证：无残留 null
  const checks = [];
  checks.push(['ExamPaper', await prisma.examPaper.count({ where: { subjectId: null } })]);
  checks.push(['Question', await prisma.question.count({ where: { subjectId: null } })]);
  checks.push(['ExamSession', await prisma.examSession.count({ where: { subjectId: null } })]);
  checks.push(['StudentWrongQuestion', await prisma.studentWrongQuestion.count({ where: { subjectId: null } })]);
  checks.push(['KnowledgePoint', await prisma.knowledgePoint.count({ where: { subjectId: null } })]);
  for (const [name, nulls] of checks) {
    console.log(`verify ${name}: nullSubjectId=${nulls} ${nulls === 0 ? 'OK' : 'FAIL'}`);
    if (nulls !== 0) process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
