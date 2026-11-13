/**
 * 步骤 B：从 data/netdisk-mapping/assets.jsonl 计算章节映射建议（不写数据库）
 * 产物：mapping-proposal.jsonl + stats.json
 * 规则与后端 netdisk-index-service 一致（复用 dist 中的纯函数）
 * 支持多学科：按每条资源所属学科，使用该学科自己的教材章节索引
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

  const idxCache = new Map();
  const sectionUniverse = new Map();
  async function indexFor(code) {
    const key = code || 'math';
    if (!idxCache.has(key)) {
      const idx = await svc.sectionIndexForSubjectCode(code);
      idxCache.set(key, idx);
      for (const s of idx.sections) {
        if (!sectionUniverse.has(s.id)) sectionUniverse.set(s.id, { id: s.id, title: s.title, subjectCode: key });
      }
    }
    return idxCache.get(key);
  }

  const out = fs.createWriteStream(OUT, 'utf8');
  const bySection = new Map();
  const bySubject = {};
  const samples = [];
  let total = 0;
  let mapped = 0;
  let unmapped = 0;
  let videoTotal = 0;
  let videoMapped = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(SRC, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    const a = JSON.parse(line);
    const subjectCode = svc.detectSubjectFromText(a.path) || 'math';
    const isVideo = a.assetKind === 'video';
    let candidates = [];
    let best = null;
    if (a.assetKind !== 'junk' && !svc.isGeoStandaloneVideo(a.path)) {
      const index = await indexFor(subjectCode);
      candidates = isVideo
        ? svc.computeVideoCandidates(a.name, index)
        : svc.computeCandidates(`${a.name} ${a.path}`, index);
      best = isVideo ? svc.pickVideoMap(candidates, svc.videoTopicText(a.name).topic) : svc.pickAutoMap(candidates);
    }
    if (isVideo) {
      videoTotal++;
      if (best) videoMapped++;
    }
    const bs = bySubject[subjectCode] || (bySubject[subjectCode] = { total: 0, mapped: 0 });
    bs.total++;
    if (best) {
      mapped++;
      bs.mapped++;
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

  const sectionRows = [...sectionUniverse.values()].map((s) => ({ ...s, mapped: bySection.get(s.id) || 0 }));
  const stats = {
    total,
    mapped,
    unmapped,
    skippedNonMath: 0,
    videoTotal,
    videoMapped,
    bySubject,
    coveredSections: sectionRows.filter((r) => r.mapped > 0).length,
    emptySections: sectionRows.filter((r) => r.mapped === 0),
    topSections: [...sectionRows].sort((a, b) => b.mapped - a.mapped).slice(0, 15),
    samples,
  };
  fs.writeFileSync(STATS, JSON.stringify(stats, null, 1), 'utf8');
  console.log(JSON.stringify({
    ok: true, total, mapped, unmapped, videoTotal, videoMapped,
    coveredSections: stats.coveredSections, emptySections: stats.emptySections.length, bySubject,
  }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
