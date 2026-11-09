/**
 * 网盘资源索引服务（M3）
 * - 递归扫描 /apps/高中学习系统（断点续扫，状态持久化到 netdisk_scan_state）
 * - 自动分类 assetKind / audience
 * - 年份 / 地区 / 系列 提取
 * - 自动章节映射（写候选列表，不自动确认）
 */
import { PrismaClient } from '@prisma/client';
import { listFilesAll, NetdiskFileEntry } from './netdisk-service';

const prisma = new PrismaClient();
const APP_ROOT = '/apps/高中学习系统';

// ============ 类型 ============
export type AssetKind = 'lecture' | 'ppt' | 'answer' | 'practice' | 'exam' | 'plan' | 'audio' | 'video' | 'image' | 'junk' | 'other';
export type Audience = 'student' | 'teacher' | 'both';

export interface SectionKeywordIndex {
  sections: { id: number; title: string; core: string; tokens: string[]; number: string | null; chapterTitle: string }[];
  byId: Map<number, { id: number; title: string }>;
}

export interface CandidateSection { sectionId: number; title: string; score: number; numHit?: boolean; tokenHits?: number; coreHit?: boolean }

// ============ 分类规则 ============
const VIDEO_EXT = new Set(['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'ts', 'm4v', 'webm']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff']);
const JUNK_EXT = new Set(['exe', 'msi', 'ttf', 'otf', 'ini', 'lnk', 'url', 'db', 'ds_store', 'apk']);

export const REGIONS = [
  '全国', '新课标', '新高考', '北京', '上海', '天津', '重庆', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '四川',
  '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];

export const SERIES = [
  '五年高考三年模拟', '五年高考三年模拟', '步步高', '高中必刷题', '必刷题', '一遍过', '全品', '金考卷',
  '赢在微点', '实验班', '邦达培优', '腾远', '高考快递', '教材帮', '解透教材', '理想树', '一数', 'MST',
  '五三', '初高衔接', '高考题库', '优化设计', '南方凤凰台',
];

const TEACHER_PAT = /教师|老师|答案|解析|详解|参考答案|课件|备课|说课|教师用书|教师版|教师配套/;
const STUDENT_PAT = /学生版|学生用书/;
const JUNK_PAT = /微信|扫码|免费领取|打印店|在线打印|自助打印|公众号|QQ群|广告|更多资料|加群|客服|水印|课件使用说明|版权声明|字体显示异常|MathType|字体库/i;

export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9_]+)$/.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

/** 自动分类：assetKind */
export function classifyAsset(name: string, extInput?: string): AssetKind {
  const ext = (extInput ?? extOf(name)).toLowerCase();
  const text = name;
  if (JUNK_EXT.has(ext) || JUNK_PAT.test(text)) return 'junk';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === 'ppt' || ext === 'pptx') return /答案|解析/.test(text) ? 'answer' : 'ppt';
  if (/答案|解析|详解|参考答案/.test(text)) return 'answer';
  if (/课件|说课|教案/.test(text)) return 'ppt';
  if (/练习|必刷|习题|作业|专项训练|刷题|一遍过|同步训练|课后|小题/.test(text)) return 'practice';
  if (/试卷|真题|模拟|月考|期中|期末|联考|套卷|调研|质检|统考|压轴/.test(text)) return 'exam';
  if (/讲义|复习|知识清单|总结|归纳|汇总|梳理|笔记|清单|手册|宝典|必背|大全|速查|考点|思维导图|速记|一轮|二轮|方法|技巧|精讲|干货|模板|答题/.test(text)) return 'plan';
  return 'other';
}

/** 自动分类：audience */
export function classifyAudience(name: string, assetKind: AssetKind): Audience {
  if (assetKind === 'junk') return 'both';
  if (TEACHER_PAT.test(name)) return 'teacher';
  if (STUDENT_PAT.test(name)) return 'student';
  if (assetKind === 'answer' || assetKind === 'ppt') return 'teacher';
  return 'both';
}

/** 年份提取（识别不到返回 null，不填默认值） */
export function extractYear(text: string): number | null {
  const all = text.match(/20\d{2}/g) || [];
  for (const s of all) {
    const n = parseInt(s, 10);
    if (n >= 2000 && n <= 2035) return n;
  }
  return null;
}

/** 地区提取 */
export function extractRegion(text: string): string | null {
  for (const r of REGIONS) if (text.includes(r)) return r;
  return null;
}

/** 系列（出版社/教辅品牌）提取，长词优先 */
export function extractSeries(text: string): string | null {
  const sorted = [...SERIES].sort((a, b) => b.length - a.length);
  for (const s of sorted) if (text.includes(s)) return s;
  return null;
}

// ============ 章节关键词与自动映射 ============
const STOP_TOKENS = new Set(['的', '与', '和', '及', '其', '一', '二', '三', '上', '下', '中', '应用', '复习', '初步']);

/** 通用词：命中仅给 1 分，避免「函数/性质」这类泛词把不同章节混在一起 */
const GENERIC_TOKENS = new Set([
  '函数', '性质', '概念', '运算', '图象', '基本', '关系', '方程', '公式', '定理', '定义',
  '问题', '方法', '综合', '练习', '表示', '意义', '案例', '统计', '概率', '向量', '三角',
  '导数', '几何', '应用', '初步', '基本关系', '基本性质',
]);

/** 去空白与常见标点，便于中文标题匹配 */
function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[【】\[\]（）()｛｝{}《》<>、，,．.·:：;；!！?？"'“”‘’\-—_]/g, '');
}

/** 从路径/文件名推断学科（取最先出现的关键词） */
const SUBJECT_WORDS: Array<[RegExp, string]> = [
  [/数学/, 'math'],
  [/物理/, 'physics'],
  [/化学/, 'chemistry'],
  [/生物/, 'biology'],
  [/语文/, 'chinese'],
  [/英语/, 'english'],
  [/政治/, 'politics'],
  [/历史/, 'history'],
  [/地理/, 'geography'],
  [/理综/, 'science'],
  [/文综/, 'liberal_arts'],
];
export function detectSubjectFromText(text: string): string | null {
  let best: { pos: number; code: string } | null = null;
  for (const [re, code] of SUBJECT_WORDS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      // 取最深（最后出现）的学科关键词：越靠后的目录/文件名越具体
      if (!best || m.index > best.pos) best = { pos: m.index, code };
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return best ? best.code : null;
}

export function sectionTokens(title: string): { core: string; tokens: string[]; number: string | null } {
  const numberMatch = title.trim().match(/^(\d{1,2}\.\d{1,2})/);
  const core = title
    .replace(/^\s*\d+(\.\d+)*\s*/, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim();
  const tokens = new Set<string>();
  const normCore = normalizeMatchText(core);
  if (normCore.length >= 3) tokens.add(normCore);
  for (const part of core.split(/[的与和、，,．./·\s]+/)) {
    const p = normalizeMatchText(part);
    if (p.length >= 2 && !STOP_TOKENS.has(part)) tokens.add(p);
  }
  return { core: normCore, tokens: [...tokens], number: numberMatch ? numberMatch[1] : null };
}

export async function loadSectionKeywordIndex(subjectId?: number): Promise<SectionKeywordIndex> {
  const sections = await prisma.section.findMany({
    where: subjectId ? { chapter: { textbook: { subjectId } } } : undefined,
    select: { id: true, title: true, chapter: { select: { title: true } } },
    orderBy: { id: 'asc' },
  });
  const list = sections.map(s => ({ id: s.id, title: s.title, ...sectionTokens(s.title), chapterTitle: s.chapter?.title || '' }));
  return { sections: list, byId: new Map(sections.map(s => [s.id, { id: s.id, title: s.title }])) };
}

/** 学科 code → subjectId（无学科关键词时兜底数学），用于多学科映射 */
const subjectIdByCode = new Map<string, number | null>();
async function resolveSubjectId(code: string | null): Promise<number | null> {
  const key = code || 'math';
  if (subjectIdByCode.has(key)) return subjectIdByCode.get(key)!;
  const s = await prisma.subject.findUnique({ where: { code: key }, select: { id: true } });
  const id = s?.id ?? null;
  subjectIdByCode.set(key, id);
  return id;
}

const sectionIndexCache = new Map<string, SectionKeywordIndex>();
export async function sectionIndexForSubjectCode(code: string | null): Promise<SectionKeywordIndex> {
  const sid = await resolveSubjectId(code);
  const key = String(sid ?? 'all');
  if (!sectionIndexCache.has(key)) {
    sectionIndexCache.set(key, await loadSectionKeywordIndex(sid ?? undefined));
  }
  return sectionIndexCache.get(key)!;
}

/** 计算候选章节（不写库）。评分：节号 +3、核心标题整串 +8（仅≥3 字）、专有分词 +2、通用词 +1 */
export function computeCandidates(text: string, index: SectionKeywordIndex, limit = 3): CandidateSection[] {
  const normText = normalizeMatchText(text);
  const scored: CandidateSection[] = [];
  for (const s of index.sections) {
    let score = 0;
    let numHit = false;
    let tokenHits = 0;
    let coreHit = false;
    if (s.number) {
      const numRe = new RegExp(`(^|[^0-9.])${s.number.replace('.', '\\.')}([^0-9.]|$)`);
      if (numRe.test(text) || normText.includes(s.number)) {
        score += 3;
        numHit = true;
      }
    }
    for (const t of s.tokens) {
      if (!normText.includes(t)) continue;
      if (t === s.core) {
        if (t.length >= 3) {
          score += 8;
          coreHit = true;
        } else {
          // 两字核心易是其它词的一部分（如「成对数据」里的「对数」），只在词边界命中时才算强信号
          const at = normText.indexOf(t);
          const prev = at > 0 ? normText[at - 1] : '';
          const next = normText[at + t.length] || '';
          const strong = at === 0
            || ['讲', '节', '章', '点', '练', '考'].includes(prev)
            || ['的', '与', '和', '及'].includes(next)
            || next === '';
          if (strong) {
            score += 6;
            coreHit = true;
          } else {
            score += 2;
            tokenHits++;
          }
        }
      } else if (GENERIC_TOKENS.has(t)) {
        score += 1;
      } else {
        score += 2;
        tokenHits++;
      }
    }
    if (score > 0) scored.push({ sectionId: s.id, title: s.title, score, numHit, tokenHits, coreHit });
  }
  scored.sort((a, b) => b.score - a.score || a.sectionId - b.sectionId);
  return scored.slice(0, limit);
}

/** 自动确认阈值与歧义要求：最高分 ≥5、领先第二名 ≥2，且必须「核心标题命中」或「节号+专有分词同时命中」 */
export const AUTO_MAP_THRESHOLD = 5;
export const AUTO_MAP_MARGIN = 2;

export function pickAutoMap(candidates: CandidateSection[]): CandidateSection | null {
  const best = candidates[0];
  if (!best || best.score < AUTO_MAP_THRESHOLD) return null;
  if (!best.coreHit && !(best.numHit && (best.tokenHits ?? 0) > 0)) return null;
  const second = candidates[1];
  if (second && best.score - second.score < AUTO_MAP_MARGIN) return null;
  return best;
}

// ============ 视频主线映射 ============
const VIDEO_TAG_RE = /【([^】]+)】/;
const VIDEO_EXT_RE = /\.(mp4|mkv|mov|avi|flv|wmv|ts|m4v|webm)$/i;

/**
 * 视频文件名 → 主题词 + 章节标签
 * 例：`p052 【函数】5.2 指数函数  052].mp4` → { tag: '函数', topic: '指数函数' }
 * 注意：课程自己的编号（5.2）与教材节号无关，这里直接丢弃
 */
export function videoTopicText(rawName: string): { topic: string; tag: string | null } {
  const tagMatch = rawName.match(VIDEO_TAG_RE);
  let t = rawName.replace(VIDEO_EXT_RE, '');
  t = t.replace(/^p\d+\s*/i, '');
  t = t.replace(VIDEO_TAG_RE, ' ');
  t = t.replace(/^\s*\d{1,2}\.\d{1,2}(\.\d+)?\s*/, ''); // 课程序号
  t = t.replace(/\s*\d+\]\s*$/, ' ');
  t = t.replace(/[\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return { topic: t, tag: tagMatch ? tagMatch[1] : null };
}

/** 视频用候选：不看节号，只看主题词与节标题的契合，外加【标签】与章名的呼应 */
export function computeVideoCandidates(rawName: string, index: SectionKeywordIndex, limit = 3): CandidateSection[] {
  const { topic, tag } = videoTopicText(rawName);
  const normTopic = normalizeMatchText(topic);
  const tagTokens = tag
    ? tag.split(/[与和、，,\s]+/).map(normalizeMatchText).filter(x => x.length >= 2)
    : [];
  const scored: CandidateSection[] = [];
  for (const s of index.sections) {
    let score = 0;
    let tokenHits = 0;
    let coreHit = false;
    for (const t of s.tokens) {
      if (!normTopic.includes(t)) continue;
      if (t === s.core && t.length >= 3) {
        score += 8;
        coreHit = true;
      } else if (GENERIC_TOKENS.has(t)) {
        score += 1;
      } else {
        score += 2;
        tokenHits++;
      }
    }
    // 【函数】→ 章名「函数的概念与性质」；【三角函数】→ 章名「三角函数」
    if (tagTokens.length && s.chapterTitle) {
      const normChapter = normalizeMatchText(s.chapterTitle);
      if (tagTokens.some(t => normChapter.includes(t))) score += 3;
    }
    if (score > 0) scored.push({ sectionId: s.id, title: s.title, score, numHit: false, tokenHits, coreHit });
  }
  scored.sort((a, b) => b.score - a.score || a.sectionId - b.sectionId);
  return scored.slice(0, limit);
}

export const VIDEO_MAP_THRESHOLD = 4;
export const VIDEO_MAP_MARGIN = 1;

/** 视频确认：必须有标题实词命中（标签加分不足以独立成锚），且领先第二名 ≥1 */
export function pickVideoMap(candidates: CandidateSection[]): CandidateSection | null {
  const best = candidates[0];
  if (!best || best.score < VIDEO_MAP_THRESHOLD) return null;
  if (!best.coreHit && (best.tokenHits ?? 0) === 0) return null;
  const second = candidates[1];
  if (second && best.score - second.score < VIDEO_MAP_MARGIN) return null;
  return best;
}

// ============ 扫描状态 ============
export interface ScanStatus {
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  currentDir: string | null;
  scannedDirs: number;
  totalFiles: number;
  queueLength: number;
  lastError: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

let running = false;
let pauseRequested = false;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function readState() {
  let st = await prisma.netdiskScanState.findUnique({ where: { id: 1 } });
  if (!st) st = await prisma.netdiskScanState.create({ data: { id: 1 } });
  return st;
}

async function writeState(data: {
  status?: string; queue?: string[]; currentDir?: string | null;
  scannedDirs?: number; totalFiles?: number; lastError?: string | null; startedAt?: Date | null;
}) {
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.status = data.status;
  if (data.queue !== undefined) payload.queue = JSON.stringify(data.queue);
  if (data.currentDir !== undefined) payload.currentDir = data.currentDir;
  if (data.scannedDirs !== undefined) payload.scannedDirs = data.scannedDirs;
  if (data.totalFiles !== undefined) payload.totalFiles = data.totalFiles;
  if (data.lastError !== undefined) payload.lastError = data.lastError;
  if (data.startedAt !== undefined) payload.startedAt = data.startedAt;
  await prisma.netdiskScanState.upsert({ where: { id: 1 }, create: { id: 1, ...payload }, update: payload });
}

export async function getScanStatus(): Promise<ScanStatus> {
  const st = await readState();
  const queue = JSON.parse(st.queue || '[]') as string[];
  return {
    status: st.status as ScanStatus['status'],
    currentDir: st.currentDir,
    scannedDirs: st.scannedDirs,
    totalFiles: st.totalFiles,
    queueLength: queue.length,
    lastError: st.lastError,
    startedAt: st.startedAt ? st.startedAt.toISOString() : null,
    updatedAt: st.updatedAt ? st.updatedAt.toISOString() : null,
  };
}

/** 单文件入库（分类 + 元数据 + 候选章节） */
async function indexFile(entry: NetdiskFileEntry) {
  const name = entry.name || entry.path.split('/').pop() || entry.path;
  const ext = extOf(name);
  const assetKind = classifyAsset(name, ext);
  const audience = classifyAudience(name, assetKind);
  const fullText = `${name} ${entry.path}`;
  const year = extractYear(fullText);
  const region = extractRegion(fullText);
  const series = extractSeries(fullText);
  const subjectCode = detectSubjectFromText(entry.path);
  const isVideo = assetKind === 'video';
  const index = await sectionIndexForSubjectCode(subjectCode);
  const candidates = assetKind === 'junk'
    ? []
    : isVideo
      ? computeVideoCandidates(name, index)
      : computeCandidates(fullText, index);
  const autoMap = isVideo ? pickVideoMap(candidates) : pickAutoMap(candidates);
  const data = {
    fsId: BigInt(entry.fsId),
    name,
    ext: ext || null,
    size: BigInt(entry.size || 0),
    mtime: entry.modifyTime ? new Date(entry.modifyTime) : null,
    assetKind,
    audience,
    year,
    region,
    series,
    candidateSections: candidates.length ? JSON.stringify(candidates) : null,
    status: assetKind === 'junk' ? 'ignored' : 'active',
  };
  const existing = await prisma.netdiskAsset.findUnique({ where: { path: entry.path }, select: { id: true, mapSource: true, mapConfirmed: true, sectionId: true, isPinned: true } });
  if (existing) {
    // 已人工确认的映射不被自动映射覆盖
    const keepManual = existing.mapSource === 'manual' || existing.mapConfirmed;
    await prisma.netdiskAsset.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(keepManual ? {} : {
          sectionId: autoMap ? autoMap.sectionId : null,
          mapSource: autoMap ? 'auto' : 'none',
          mapConfirmed: !!autoMap,
        }),
      },
    });
  } else {
    await prisma.netdiskAsset.create({
      data: {
        ...data,
        path: entry.path,
        sectionId: autoMap ? autoMap.sectionId : null,
        mapSource: autoMap ? 'auto' : 'none',
        mapConfirmed: !!autoMap,
      },
    });
  }
}

async function runScanLoop() {
  try {
    for (;;) {
      if (pauseRequested) { await writeState({ status: 'paused' }); running = false; return; }
      const st = await readState();
      const queue = JSON.parse(st.queue || '[]') as string[];
      if (queue.length === 0) { await writeState({ status: 'done', currentDir: null }); running = false; return; }
      const dir = queue.shift() as string;
      await writeState({ queue, currentDir: dir });
      let entries: NetdiskFileEntry[] = [];
      try {
        entries = await listFilesAll(dir === APP_ROOT ? '/' : dir);
      } catch (e) {
        await writeState({ lastError: `${dir}: ${(e as Error).message}` });
        await sleep(1500);
        continue;
      }
      const dirs: string[] = [];
      let files = 0;
      for (const entry of entries) {
        if (entry.isDir === 1) { dirs.push(entry.path); continue; }
        try { await indexFile(entry); files++; } catch { /* 跳过单文件错误 */ }
      }
      const nextQueue = queue.concat(dirs);
      const st2 = await readState();
      await writeState({
        queue: nextQueue,
        scannedDirs: st2.scannedDirs + 1,
        totalFiles: st2.totalFiles + files,
        lastError: null,
      });
      await sleep(180); // 限流：避免触发网盘接口频率限制
    }
  } catch (e) {
    await writeState({ status: 'error', lastError: (e as Error).message });
    running = false;
  }
}

export async function startScan(opts: { restart?: boolean } = {}): Promise<{ started: boolean; status: ScanStatus }> {
  const st = await readState();
  if (running && !opts.restart) return { started: false, status: await getScanStatus() };
  let queue: string[];
  if (opts.restart) {
    queue = [APP_ROOT];
  } else {
    const saved = JSON.parse(st.queue || '[]') as string[];
    queue = saved.length ? saved : (st.status === 'done' ? [APP_ROOT] : [APP_ROOT]);
  }
  pauseRequested = false;
  running = true;
  await writeState({
    status: 'running',
    queue,
    currentDir: null,
    scannedDirs: opts.restart ? 0 : st.scannedDirs,
    totalFiles: opts.restart ? 0 : st.totalFiles,
    lastError: null,
    startedAt: opts.restart || !st.startedAt ? new Date() : st.startedAt,
  });
  runScanLoop();
  return { started: true, status: await getScanStatus() };
}

export async function pauseScan() {
  pauseRequested = true;
  await writeState({ status: 'paused' });
  return getScanStatus();
}

// ============ 查询与操作 ============
export interface AssetFilters {
  sectionId?: number | null;
  unmapped?: boolean;
  assetKind?: string;
  audience?: string;
  status?: string;
  q?: string;
  mapConfirmed?: boolean;
  isPinned?: boolean;
  page?: number;
  limit?: number;
}

export async function listAssets(f: AssetFilters) {
  const where: Record<string, unknown> = {};
  if (f.unmapped) where.sectionId = null;
  else if (f.sectionId != null) where.sectionId = f.sectionId;
  if (f.assetKind) where.assetKind = f.assetKind;
  if (f.audience) where.audience = f.audience;
  if (f.status) where.status = f.status;
  if (f.mapConfirmed !== undefined) where.mapConfirmed = f.mapConfirmed;
  if (f.isPinned !== undefined) where.isPinned = f.isPinned;
  if (f.q) where.name = { contains: f.q };
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.min(200, Math.max(1, f.limit ?? 50));
  const [total, data] = await Promise.all([
    prisma.netdiskAsset.count({ where }),
    prisma.netdiskAsset.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { section: { select: { id: true, title: true, chapter: { select: { title: true, textbook: { select: { name: true } } } } } } },
    }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getStats() {
  const [total, mapped, pinned, byKind, byAudience, bySection] = await Promise.all([
    prisma.netdiskAsset.count(),
    prisma.netdiskAsset.count({ where: { sectionId: { not: null } } }),
    prisma.netdiskAsset.count({ where: { isPinned: true } }),
    prisma.netdiskAsset.groupBy({ by: ['assetKind'], _count: { _all: true } }),
    prisma.netdiskAsset.groupBy({ by: ['audience'], _count: { _all: true } }),
    prisma.netdiskAsset.groupBy({ by: ['sectionId'], where: { sectionId: { not: null } }, _count: { _all: true } }),
  ]);
  const sectionIds = bySection.map(s => s.sectionId as number);
  const sections = sectionIds.length
    ? await prisma.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, title: true } })
    : [];
  const titleById = new Map(sections.map(s => [s.id, s.title]));
  return {
    total,
    mapped,
    unmapped: total - mapped,
    pinned,
    byKind: byKind.map(k => ({ key: k.assetKind, count: k._count._all })),
    byAudience: byAudience.map(a => ({ key: a.audience, count: a._count._all })),
    bySection: bySection
      .filter(s => s.sectionId != null)
      .map(s => ({ sectionId: s.sectionId as number, title: titleById.get(s.sectionId as number) ?? '', count: s._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export const MAX_PINNED_PER_SECTION = 5;

export class IndexError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

export async function updateAsset(id: number, data: {
  sectionId?: number | null; mapConfirmed?: boolean; isPinned?: boolean;
  status?: string; assetKind?: string; audience?: string;
}) {
  const asset = await prisma.netdiskAsset.findUnique({ where: { id } });
  if (!asset) throw new IndexError('资源不存在', 404);
  const payload: Record<string, unknown> = {};
  if (data.sectionId !== undefined) {
    if (data.sectionId !== null) {
      const sec = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!sec) throw new IndexError('小节不存在', 404);
      payload.sectionId = data.sectionId;
      payload.mapSource = 'manual';
      payload.mapConfirmed = true;
    } else {
      payload.sectionId = null;
      payload.mapSource = 'none';
      payload.mapConfirmed = false;
      payload.isPinned = false;
    }
  }
  if (data.mapConfirmed !== undefined) {
    if (data.mapConfirmed && (payload.sectionId ?? asset.sectionId) == null) throw new IndexError('请先挂载小节再确认');
    payload.mapConfirmed = data.mapConfirmed;
    if (data.mapConfirmed) payload.mapSource = 'manual';
  }
  if (data.isPinned !== undefined) {
    if (data.isPinned) await assertPinCapacity(asset.sectionId, [id]);
    payload.isPinned = data.isPinned;
  }
  if (data.status !== undefined) {
    if (!['active', 'archive', 'ignored'].includes(data.status)) throw new IndexError('status 非法');
    payload.status = data.status;
  }
  if (data.assetKind !== undefined) payload.assetKind = data.assetKind;
  if (data.audience !== undefined) payload.audience = data.audience;
  return prisma.netdiskAsset.update({ where: { id }, data: payload });
}

async function assertPinCapacity(sectionId: number | null | undefined, incomingIds: number[]) {
  if (sectionId == null) throw new IndexError('请先挂载小节再设为精选');
  const existing = await prisma.netdiskAsset.count({
    where: { sectionId, isPinned: true, id: { notIn: incomingIds } },
  });
  if (existing + incomingIds.length > MAX_PINNED_PER_SECTION) {
    throw new IndexError(`每节最多精选 ${MAX_PINNED_PER_SECTION} 条资源（本次 ${incomingIds.length} 条，该节已有 ${existing} 条）`);
  }
}

export type BatchAction = 'confirm' | 'move' | 'pin' | 'unpin' | 'archive' | 'restore' | 'ignore' | 'unmap';

export async function batchAction(ids: number[], action: BatchAction, sectionId?: number | null) {
  if (!ids.length) throw new IndexError('ids 不能为空');
  const assets = await prisma.netdiskAsset.findMany({ where: { id: { in: ids } } });
  if (assets.length === 0) throw new IndexError('资源不存在', 404);

  if (action === 'move') {
    if (sectionId == null) throw new IndexError('请指定目标小节');
    const sec = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sec) throw new IndexError('小节不存在', 404);
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { sectionId, mapSource: 'manual', mapConfirmed: true } });
  } else if (action === 'confirm') {
    const missing = assets.filter(a => a.sectionId == null).map(a => a.id);
    if (missing.length) throw new IndexError(`有 ${missing.length} 条资源未挂载小节，无法确认`);
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { mapConfirmed: true, mapSource: 'manual' } });
  } else if (action === 'pin') {
    const bySection = new Map<number, number[]>();
    for (const a of assets) {
      if (a.sectionId == null) throw new IndexError('请先挂载小节再设为精选');
      bySection.set(a.sectionId, [...(bySection.get(a.sectionId) ?? []), a.id]);
    }
    for (const [secId, groupIds] of bySection) await assertPinCapacity(secId, groupIds);
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { isPinned: true } });
  } else if (action === 'unpin') {
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { isPinned: false } });
  } else if (action === 'archive') {
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { status: 'archive' } });
  } else if (action === 'restore') {
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { status: 'active' } });
  } else if (action === 'ignore') {
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { status: 'ignored' } });
  } else if (action === 'unmap') {
    await prisma.netdiskAsset.updateMany({ where: { id: { in: ids } }, data: { sectionId: null, mapSource: 'none', mapConfirmed: false, isPinned: false } });
  } else {
    throw new IndexError('未知操作');
  }
  return { success: true, affected: ids.length };
}

/** 抽检：某节的精选与可用资源数 */
export async function sectionConvergence(sectionIds: number[]) {
  const rows = await prisma.netdiskAsset.groupBy({
    by: ['sectionId', 'isPinned'],
    where: { sectionId: { in: sectionIds }, status: 'active', audience: { in: ['student', 'both'] }, mapConfirmed: true },
    _count: { _all: true },
  });
  const result = sectionIds.map(id => {
    const pinned = rows.find(r => r.sectionId === id && r.isPinned)?._count._all ?? 0;
    const more = rows.find(r => r.sectionId === id && !r.isPinned)?._count._all ?? 0;
    return { sectionId: id, pinned, more, total: pinned + more, ok: pinned >= 3 && pinned <= 5 };
  });
  return result;
}


/**
 * 全量重新自动映射（人工确认过的条目不覆盖）
 * 视频 = 主线：按主题词 + 章节标签定位教材节（忽略课程内编号）
 * 其他资源 = 辅助：节号 + 标题分词
 */
export async function remapAll(): Promise<{ scanned: number; mapped: number; perSection: number }> {
  const pageSize = 500;
  let cursor = 0;
  let scanned = 0;
  let mapped = 0;
  for (;;) {
    const batch = await prisma.netdiskAsset.findMany({
      where: { id: { gt: cursor }, status: { not: 'ignored' }, mapSource: { not: 'manual' } },
      select: { id: true, name: true, path: true, assetKind: true },
      orderBy: { id: 'asc' },
      take: pageSize,
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    const ops: any[] = [];
    for (const a of batch) {
      scanned++;
      const subjectCode = detectSubjectFromText(a.path);
      const isVideo = a.assetKind === 'video';
      const text = `${a.name} ${a.path}`;
      const index = await sectionIndexForSubjectCode(subjectCode);
      const candidates = isVideo
        ? computeVideoCandidates(a.name, index)
        : computeCandidates(text, index);
      const best = isVideo ? pickVideoMap(candidates) : pickAutoMap(candidates);
      if (best) mapped++;
      ops.push(prisma.netdiskAsset.update({
        where: { id: a.id },
        data: {
          candidateSections: candidates.length ? JSON.stringify(candidates) : null,
          sectionId: best ? best.sectionId : null,
          mapSource: best ? 'auto' : 'none',
          mapConfirmed: !!best,
        },
      }));
    }
    await prisma.$transaction(ops);
  }
  const perSection = await prisma.section.count({ where: { netdiskAssets: { some: { mapConfirmed: true, status: 'active' } } } });
  return { scanned, mapped, perSection };
}
