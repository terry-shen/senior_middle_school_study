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
  sections: { id: number; title: string; core: string; tokens: string[] }[];
  byId: Map<number, { id: number; title: string }>;
}

export interface CandidateSection { sectionId: number; title: string; score: number }

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

export function sectionTokens(title: string): { core: string; tokens: string[] } {
  const core = title
    .replace(/^\s*\d+(\.\d+)*\s*/, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim();
  const tokens = new Set<string>();
  if (core.length >= 3) tokens.add(core);
  for (const part of core.split(/[的与和、，,．./·\s]+/)) {
    if (part.length >= 2 && !STOP_TOKENS.has(part)) tokens.add(part);
  }
  return { core, tokens: [...tokens] };
}

export async function loadSectionKeywordIndex(subjectId?: number): Promise<SectionKeywordIndex> {
  const sections = await prisma.section.findMany({
    where: subjectId ? { chapter: { textbook: { subjectId } } } : undefined,
    select: { id: true, title: true },
    orderBy: { id: 'asc' },
  });
  const list = sections.map(s => ({ id: s.id, title: s.title, ...sectionTokens(s.title) }));
  return { sections: list, byId: new Map(sections.map(s => [s.id, { id: s.id, title: s.title }])) };
}

/** 计算候选章节（不写库） */
export function computeCandidates(text: string, index: SectionKeywordIndex, limit = 3): CandidateSection[] {
  const scored: CandidateSection[] = [];
  for (const s of index.sections) {
    let score = 0;
    for (const t of s.tokens) {
      if (!text.includes(t)) continue;
      score += t === s.core ? 4 : t.length >= 3 ? 2 : 1;
    }
    if (score > 0) scored.push({ sectionId: s.id, title: s.title, score });
  }
  scored.sort((a, b) => b.score - a.score || a.sectionId - b.sectionId);
  return scored.slice(0, limit);
}

export const AUTO_MAP_THRESHOLD = 3;

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
async function indexFile(entry: NetdiskFileEntry, index: SectionKeywordIndex) {
  const name = entry.name || entry.path.split('/').pop() || entry.path;
  const ext = extOf(name);
  const assetKind = classifyAsset(name, ext);
  const audience = classifyAudience(name, assetKind);
  const fullText = `${name} ${entry.path}`;
  const year = extractYear(fullText);
  const region = extractRegion(fullText);
  const series = extractSeries(fullText);
  const candidates = assetKind === 'junk' ? [] : computeCandidates(fullText, index);
  const best = candidates[0];
  const autoMap = best && best.score >= AUTO_MAP_THRESHOLD;
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
          sectionId: autoMap ? best.sectionId : null,
          mapSource: autoMap ? 'auto' : 'none',
          mapConfirmed: false,
        }),
      },
    });
  } else {
    await prisma.netdiskAsset.create({
      data: {
        ...data,
        path: entry.path,
        sectionId: autoMap ? best.sectionId : null,
        mapSource: autoMap ? 'auto' : 'none',
        mapConfirmed: false,
      },
    });
  }
}

async function runScanLoop() {
  const index = await loadSectionKeywordIndex();
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
        try { await indexFile(entry, index); files++; } catch { /* 跳过单文件错误 */ }
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
