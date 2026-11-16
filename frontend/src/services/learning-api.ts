/**
 * 学习 API（v3）：学科目录 / 视频主线课程 / 小节资源 / 学习进度 / 最近打开
 */
import { withSubjectParam } from './subjects-api';

const API_BASE = '/api';

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `请求失败（${res.status}）`);
  return data as T;
}

export interface LearningSubject {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  sectionCount: number;
  videoCount: number;
}

export interface AssetLite {
  id: number;
  fsId: string | null;
  name: string;
  ext: string | null;
  size: string | null;
  assetKind: string;
  audience: string;
  year: number | null;
  region: string | null;
  series: string | null;
  isPinned: boolean;
  status: string;
  mapConfirmed: boolean;
}

export interface SectionBrief {
  id: number;
  title: string;
  chapterTitle: string;
  textbookName: string;
}

export interface ResourceGroup {
  key: 'video' | 'lecture' | 'practice' | 'exam';
  label: string;
  items: AssetLite[];
}

export interface SectionResourcesFeatured {
  section: SectionBrief;
  groups: ResourceGroup[];
  pinnedCount: number;
  moreCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SectionResourcesList {
  section: SectionBrief;
  data: AssetLite[];
  pagination: Pagination;
}

export interface LearningProgress {
  sectionId: number;
  subjectId?: number | null;
  sectionTitle: string;
  chapterTitle: string;
  textbookName: string;
  assetId: number | null;
  assetName: string | null;
  updatedAt: string;
}

export interface RecentOpen {
  sectionId: number;
  sectionTitle: string;
  chapterTitle: string;
  textbookName: string;
  assetId: number | null;
  assetName: string | null;
  openedAt: string;
}

export interface VideoSeriesItem {
  id: number;
  name: string;
  courseNo: number | null;
  fsId: string | null;
  size: string | null;
}

export interface CourseSectionNode {
  id: number;
  title: string;
  textbookName: string;
  chapterTitle: string;
  resourceCount: number;
}

export interface VideoSeriesGroup {
  tag: string;
  videos: VideoSeriesItem[];
  sections: CourseSectionNode[];
}

export interface VideoSeries {
  series: string;
  groups: VideoSeriesGroup[];
  total: number;
}

export async function getLearningSubjects(token: string) {
  return req<{ success: boolean; data: LearningSubject[] }>(token, '/learning/subjects');
}

export async function getFeaturedResources(token: string, sectionId: number) {
  return req<SectionResourcesFeatured>(token, `/learning/sections/${sectionId}/resources?mode=featured`);
}

export async function getMoreResources(token: string, sectionId: number, page = 1, limit = 12) {
  return req<SectionResourcesList>(
    token,
    `/learning/sections/${sectionId}/resources?mode=more&page=${page}&limit=${limit}`,
  );
}

export async function getManageResources(token: string, sectionId: number, page = 1, limit = 50) {
  return req<SectionResourcesList>(
    token,
    `/learning/sections/${sectionId}/resources?mode=manage&page=${page}&limit=${limit}`,
  );
}

export async function recordProgress(token: string, sectionId: number, assetId?: number | null) {
  return req<{ success: boolean; progress: { sectionId: number; assetId: number | null } }>(token, '/learning/progress', {
    method: 'POST',
    body: JSON.stringify({ sectionId, assetId: assetId ?? undefined }),
  });
}

export async function getProgress(token: string) {
  return req<{ success: boolean; progress: LearningProgress | null }>(token, '/learning/progress');
}

export async function getRecentOpens(token: string, limit = 5) {
  return req<{ success: boolean; data: RecentOpen[] }>(token, `/learning/recent?limit=${limit}`);
}

export async function getViewedSectionCounts(token: string) {
  return req<{ success: boolean; data: Record<string, number> }>(token, '/learning/viewed-counts');
}

export async function getVideoSeries(token: string) {
  return req<{ success: boolean; series: VideoSeries[]; total: number }>(
    token,
    withSubjectParam('/learning/video-series'),
  );
}

// ---------------- 学习行为统计 ----------------

export interface LearningEventInput {
  type: 'heartbeat' | 'asset_open' | 'asset_dwell' | 'video_progress' | 'download' | 'login';
  sectionId?: number | null;
  assetId?: number | null;
  durationSec?: number;
  meta?: unknown;
}

/** 上报学习行为事件；失败静默（埋点不应影响学习流程） */
export async function reportLearningEvent(token: string, input: LearningEventInput): Promise<void> {
  try {
    await fetch(`${API_BASE}/learning/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch { /* ignore */ }
}

export interface AnalyticsOverviewRow {
  studentId: number;
  studentNo: string;
  name: string;
  className: string | null;
  studySec: number;
  videoSec: number;
  opens: number;
  downloads: number;
  activeDays: number;
  streak: number;
  lastActiveAt: string | null;
  videoCompletion: number | null;
}

export async function getAnalyticsOverview(token: string, days = 30) {
  return req<{ success: boolean; data: AnalyticsOverviewRow[] }>(token, `/learning/analytics/overview?days=${days}`);
}

export interface AnalyticsDetail {
  success: boolean;
  student: { id: number; studentId: string; name: string; class: { name: string } | null };
  totals: { studySec: number; videoSec: number; dwellSec: number; opens: number; downloads: number; events: number };
  daily: { date: string; sec: number; videoSec: number; opens: number }[];
  hours: number[];
  topSections: { sectionId: number; title: string; chapterTitle: string | null; textbookName: string | null; subjectName: string | null; sec: number }[];
  topAssets: {
    assetId: number | null; name: string; sectionId: number | null; sec: number; videoSec: number; opens: number; lastAt: string;
    sectionTitle: string | null; chapterTitle: string | null; subjectName: string | null;
  }[];
  subjectShare: { name: string; sec: number }[];
  recent: {
    id: number; type: string; sectionId: number | null; assetId: number | null; durationSec: number; createdAt: string;
    assetName: string | null; sectionTitle: string | null; chapterTitle: string | null; textbookName: string | null; subjectName: string | null;
    meta: Record<string, unknown> | null;
  }[];
}

export async function getAnalyticsStudent(token: string, studentId: number, days = 30) {
  return req<AnalyticsDetail>(token, `/learning/analytics/students/${studentId}?days=${days}`);
}
