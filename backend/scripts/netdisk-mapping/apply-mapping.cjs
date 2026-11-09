/**
 * 步骤 C：把 mapping-proposal.jsonl 分批写入数据库（可断点续跑）
 * 用法：node apply-mapping.cjs [--reset]   （--reset 忽略 checkpoint 从头开始）
 * 产物：data/netdisk-mapping/apply-checkpoint.json
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DIR = path.resolve(__dirname, '../../../data/netdisk-mapping');
const SRC = path.join(DIR, 'mapping-proposal.jsonl');
const CKPT = path.join(DIR, 'apply-checkpoint.json');
const BATCH = 500;

function loadCheckpoint(reset) {
  if (reset || !fs.existsSync(CKPT)) return { line: 0, applied: 0, confirmed: 0 };
  try { return JSON.parse(fs.readFileSync(CKPT, 'utf8')); } catch { return { line: 0, applied: 0, confirmed: 0 }; }
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error('缺少 mapping-proposal.jsonl，请先运行 propose-mapping.cjs');
  const reset = process.argv.includes('--reset');
  const ckpt = loadCheckpoint(reset);
  let lineNo = 0, applied = 0, confirmed = 0, batch = [];

  const flush = async () => {
    if (!batch.length) return;
    await prisma.$transaction(batch);
    applied += batch.length;
    batch = [];
    fs.writeFileSync(CKPT, JSON.stringify({ line: lineNo, applied, confirmed }), 'utf8');
    process.stdout.write(`\rapplied ${applied} (line ${lineNo})   `);
  };

  const rl = readline.createInterface({ input: fs.createReadStream(SRC, 'utf8'), crlfDelay: Infinity });
  for await (const raw of rl) {
    lineNo++;
    if (lineNo <= ckpt.line) continue;
    if (!raw.trim()) continue;
    const p = JSON.parse(raw);
    if (p.mapConfirmed) confirmed++;
    batch.push(prisma.netdiskAsset.update({
      where: { id: p.id },
      data: {
        sectionId: p.sectionId,
        mapSource: p.mapSource,
        mapConfirmed: p.mapConfirmed,
        candidateSections: p.candidates && p.candidates.length ? JSON.stringify(p.candidates) : null,
      },
    }));
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`\ndone applied=${applied} confirmed=${confirmed}`);

  const [total, conf, vis] = await Promise.all([
    prisma.netdiskAsset.count(),
    prisma.netdiskAsset.count({ where: { mapConfirmed: true } }),
    prisma.netdiskAsset.count({ where: { status: 'active', audience: { in: ['student', 'both'] }, mapConfirmed: true } }),
  ]);
  const perSection = await prisma.section.count({ where: { netdiskAssets: { some: { mapConfirmed: true, status: 'active' } } } });
  console.log(JSON.stringify({ total, confirmed: conf, studentVisible: vis, coveredSections: perSection }));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
