const API_BASE = '/api';

export interface SectionNode {
  id: number;
  order: number;
  title: string;
  resourceCount: number;
}

export interface ChapterNode {
  id: number;
  order: number;
  title: string;
  sectionCount: number;
  sections: SectionNode[];
}

export interface TextbookNode {
  id: number;
  name: string;
  edition: string;
  grade: string | null;
  order: number;
  chapterCount: number;
  sectionCount: number;
  chapters: ChapterNode[];
}

export interface FlatSection {
  id: number;
  title: string;
  order: number;
  chapterId: number;
  chapterTitle: string;
  textbookId: number;
  textbookName: string;
  label: string;
}

async function req(path: string, opts: RequestInit = {}, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `请求失败 (${res.status})`);
  return data;
}

export async function getTaxonomyTree(token: string, subjectId?: number): Promise<TextbookNode[]> {
  const qs = subjectId ? `?subjectId=${subjectId}` : '';
  const data = await req(`/chapters/tree${qs}`, {}, token);
  return (data?.data || []) as TextbookNode[];
}

export async function listFlatSections(token: string, subjectId?: number): Promise<FlatSection[]> {
  const qs = subjectId ? `?subjectId=${subjectId}` : '';
  const data = await req(`/chapters/sections${qs}`, {}, token);
  return (data?.data || []) as FlatSection[];
}

export function createTextbook(token: string, payload: { subjectId: number; name: string; edition?: string; grade?: string | null; order?: number }) {
  return req('/chapters/textbooks', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function updateTextbook(token: string, id: number, payload: { name?: string; edition?: string; grade?: string | null; order?: number }) {
  return req(`/chapters/textbooks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);
}

export function deleteTextbook(token: string, id: number) {
  return req(`/chapters/textbooks/${id}`, { method: 'DELETE' }, token);
}

export function createChapter(token: string, payload: { textbookId: number; title: string; order?: number }) {
  return req('/chapters/chapters', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function updateChapter(token: string, id: number, payload: { title?: string; order?: number }) {
  return req(`/chapters/chapters/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);
}

export function deleteChapter(token: string, id: number) {
  return req(`/chapters/chapters/${id}`, { method: 'DELETE' }, token);
}

export function createSection(token: string, payload: { chapterId: number; title: string; order?: number }) {
  return req('/chapters/sections', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function updateSection(token: string, id: number, payload: { title?: string; order?: number }) {
  return req(`/chapters/sections/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token);
}

export function deleteSection(token: string, id: number) {
  return req(`/chapters/sections/${id}`, { method: 'DELETE' }, token);
}

export function getSectionReferences(token: string, id: number) {
  return req(`/chapters/sections/${id}/references`, {}, token);
}
