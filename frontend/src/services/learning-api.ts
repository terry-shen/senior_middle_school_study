/**
 * 学生学习 API（M4）：章节资源三档、章节地图、我的学习工作台
 */
import { withSubjectParam } from './subjects-api';

const API_BASE = 'http://localhost:3000/api';

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

export interface SectionPaper {
  id: number;
  title: string;
  year: number | null;
  region: string | null;
  examType: string | null;
  totalScore: number | null;
  duration: number | null;
  purpose: string;
  pdfUrl: string | null;
  status: string;
  subject: { id: number; name: string } | null;
}

export interface SectionWrongQuestion {
  id: number;
  content: string;
  imageUrl: string | null;
  questionType: string;
  difficulty: string | null;
  myAnswer: string | null;
  correctAnswer: string | null;
  analysis: string | null;
  reviewStatus: string;
  createdAt: string;
}

export interface LearningProgress {
  sectionId: number;
  sectionTitle: string;
  chapterTitle: string;
  textbookName: string;
  assetId: number | null;
  assetName: string | null;
  updatedAt: string;
}

export interface MapSection {
  id: number;
  order: number;
  title: string;
  resourceCount: number;
  paperCount: number;
  weakCount: number;
  isCurrent: boolean;
}

export interface MapChapter {
  id: number;
  order: number;
  title: string;
  sections: MapSection[];
}

export interface MapBook {
  id: number;
  name: string;
  edition: string;
  grade: string | null;
  chapters: MapChapter[];
}

export interface WorkbenchPendingExam {
  id: number;
  title: string;
  mode: string;
  totalScore: number | null;
  duration: number | null;
  status: string;
  createdAt: string;
  paper: { id: number; title: string; purpose: string } | null;
}

export interface WorkbenchWeakQuestion {
  id: number;
  content: string;
  questionType: string;
  sectionId: number | null;
  createdAt: string;
}

export interface StudentWorkbench {
  progress: LearningProgress | null;
  pendingExams: WorkbenchPendingExam[];
  weakCount: number;
  weakTop: WorkbenchWeakQuestion[];
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

export async function getSectionPapers(token: string, sectionId: number) {
  return req<{ success: boolean; data: SectionPaper[] }>(token, `/learning/sections/${sectionId}/papers`);
}

export async function getSectionWrongQuestions(token: string, sectionId: number, studentId?: number) {
  const qs = studentId ? `?studentId=${studentId}` : '';
  return req<{ success: boolean; data: SectionWrongQuestion[] }>(
    token,
    `/learning/sections/${sectionId}/wrong-questions${qs}`,
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

export async function getLearningMap(token: string) {
  return req<{ success: boolean; data: MapBook[] }>(token, withSubjectParam('/learning/map'));
}

export async function getStudentLearningMap(token: string, studentId: number) {
  return req<{ success: boolean; data: MapBook[] }>(
    token,
    withSubjectParam(`/learning/map/student/${studentId}`),
  );
}

export async function getStudentWorkbench(token: string) {
  return req<{ success: boolean } & StudentWorkbench>(token, withSubjectParam('/learning/workbench'));
}
