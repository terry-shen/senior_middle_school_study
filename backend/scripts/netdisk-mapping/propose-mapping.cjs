/**
 * 步骤 B：基于 data/netdisk-mapping/assets.jsonl 计算章节映射建议（不写数据库）
 * 产物：mapping-proposal.jsonl + stats.json
 * 规则与后端 netdisk-index-service 保持一致（复用 dist 中的纯函数）
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const svc = require('../../dist/services/netdisk-index-service.js');

const DIR = path.resolve(__dirname, '../../../data/netdisk-mapping');
const SRC = path.join(DIR, 'assets.jsonl');
const OUT = path.join(DIR, 'mapping-proposal.jsonl');
const STATS = path.join(DIR, 'stats.json');

async function main() {
  if (!fs.existsSync(SRC)) throw new Error('缺少 assets.jsonl，请先运行 export-assets.cjs');

  const index = await svc.loadSectionKeywordIndex();
  const out = fs.createWriteStream(OUT, 'utf8');
  const bySection = new Map();
  const samples = [];
  let total = 0, mapped = 0, skippedNonMath = 0, unmapped = 0;
  let videoTotal = 0, videoMapped = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(SRC, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    const a = JSON.parse(line);
    const subjectCode = svc.detectSubjectFromText(a.path);
    const isMath = subjectCode === null || subjectCode === 'math';
    const isVideo = a.assetKind === 'video';
    let candidates = [];
    let best = null;
    if (a.assetKind !== 'junk' && isMath) {
      // 视频 = 主线（主题词 + 章节标签）；其他资源 = 辅助（节号 + 标题分词）
      candidates = isVideo ? svc.computeVideoCandidates(a.name, index) : svc.computeCandidates(`${a.name} ${a.path}`, index);
      best = isVideo ? svc.pickVideoMap(candidates) : svc.pickAutoMap(candidates);
    }
    if (isVideo) {
      videoTotal++;
      if (best) videoMapped++;
    }
    if (!isMath) skippedNonMath++;
    if (best) {
      mapped++;
      bySection.set(best.sectionId, (bySection.get(best.sectionId) || 0) + 1);
      if (samples.length < 30 && mapped % 97 === 0) {
        samples.push({ id: a.id, name: a.name, subjectCode, sectionId: best.sectionId, title: best.title, score: best.score });
      }
    } else {
      unmapped++;
    }
    out.write(JSON.stringify({
      id: a.id,
      sectionId: best ? best.sectionId : null,
      mapSource: best ? 'auto' : 'none',
      mapConfirmed: !!best,
      score: best ? best.score : 0,
      margin: best ? best.score - (candidates[1]?.score ?? 0) : 0,
      numHit: best ? !!best.numHit : false,
      tokenHits: best ? best.tokenHits || 0 : 0,
      assetKind: a.assetKind,
      subjectCode,
      candidates: candidates.map((c) => ({ sectionId: c.sectionId, title: c.title, score: c.score })),
    }) + '\n');
  }
  await new Promise((r) => out.end(r));

  const sectionRows = index.sections.map((s) => ({ id: s.id, title: s.title, mapped: bySection.get(s.id) || 0 }));
  const stats = {
    total,
    mapped,
    unmapped,
    skippedNonMath,
    videoTotal,
    videoMapped,
    coveredSections: sectionRows.filter((r) => r.mapped > 0).length,
    emptySections: sectionRows.filter((r) => r.mapped === 0),
    topSections: [...sectionRows].sort((a, b) => b.mapped - a.mapped).slice(0, 15),
    samples,
  };
  fs.writeFileSync(STATS, JSON.stringify(stats, null, 1), 'utf8');
  console.log(JSON.stringify({ ok: true, total, mapped, unmapped, skippedNonMath, videoTotal, videoMapped, coveredSections: stats.coveredSections, emptySections: stats.emptySections.length }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
