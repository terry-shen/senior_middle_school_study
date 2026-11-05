/**
 * Video Library API — /api/video-resources（学习资源：视频+教辅）
 */
import { withSubjectParam } from './subjects-api';

const API_BASE = 'http://localhost:3000/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface VideoResource {
  id: number;
  title: string;
  subjectId?: number | null;
  subject?: { id: number; name: string; icon?: string } | null;
  grade?: string | null;
  chapter?: string | null;
  resourceType: 'video' | 'document';
  netdiskPath: string;
  fsId?: string | null;
  shareUrl?: string | null;
  fileUrl?: string | null;
  fileSize?: number | string | null;
  duration?: number | null;
  coverUrl?: string | null;
  description?: string | null;
  playCount: number;
  viewCount: number;
  sort: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoResourceInput {
  title: string;
  subjectId?: number | null;
  grade?: string | null;
  chapter?: string | null;
  resourceType: 'video' | 'document';
  netdiskPath: string;
  fsId?: string | null;
  shareUrl?: string | null;
  fileUrl?: string | null;
  duration?: number | null;
  coverUrl?: string | null;
  description?: string | null;
  sort?: number;
  isActive?: boolean;
}

export interface ResourceListFilters {
  type?: 'video' | 'document';
  keyword?: string;
  page?: number;
  limit?: number;
}

export async function listResources(token: string, filters: ResourceListFilters = {}, manage = false): Promise<{ data: VideoResource[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.keyword) params.append('keyword', filters.keyword);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (manage) params.append('manage', '1');
  const res = await fetch(withSubjectParam(`${API_BASE}/video-resources?${params.toString()}`), { headers: authHeaders(token) });
  return res.json();
}

export async function getResource(token: string, id: number): Promise<VideoResource> {
  const res = await fetch(`${API_BASE}/video-resources/${id}`, { headers: authHeaders(token) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '资源不存在');
  return d;
}

export async function createResource(token: string, data: VideoResourceInput): Promise<{ success: boolean; resource?: VideoResource; error?: string }> {
  const res = await fetch(`${API_BASE}/video-resources`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateResource(token: string, id: number, data: Partial<VideoResourceInput>): Promise<{ success: boolean; resource?: VideoResource; error?: string }> {
  const res = await fetch(`${API_BASE}/video-resources/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteResource(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/video-resources/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return res.json();
}

export interface ImportItem {
  fsId: number | string;
  path: string;
  size?: number | string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  skipped: number;
  shareFailed: number[];
  downloadFailed: number[];
  resources: number[];
}

export async function importResources(
  token: string,
  items: ImportItem[],
  opts: { subjectId?: number | null; grade?: string; chapter?: string; downloadDocuments?: boolean } = {}
): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/video-resources/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      items,
      subjectId: opts.subjectId ?? null,
      grade: opts.grade ?? null,
      chapter: opts.chapter ?? null,
      downloadDocuments: opts.downloadDocuments !== false,
    }),
  });
  return res.json();
}

export async function recordPlay(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/video-resources/${id}/play`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json();
}
