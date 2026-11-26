const API_BASE = '/api';

export type ActivityEventType =
  | 'page_view'
  | 'nav_click'
  | 'subject_open'
  | 'chapter_open'
  | 'asset_open'
  | 'video_play'
  | 'video_pause'
  | 'video_ended'
  | 'video_seek'
  | 'search'
  | 'filter'
  | 'download'
  | 'ui_click';

export interface ActivityEventInput {
  type: ActivityEventType;
  pagePath: string;
  target?: string | null;
  label?: string | null;
  subjectId?: number | null;
  sectionId?: number | null;
  assetId?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface ActivityLogRow {
  id: number;
  type: ActivityEventType;
  pagePath: string;
  target: string | null;
  label: string | null;
  subjectId: number | null;
  sectionId: number | null;
  assetId: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityLogQuery {
  days?: number;
  type?: ActivityEventType | '';
  page?: number;
  limit?: number;
}

interface ActivityListResponse {
  success: boolean;
  data: ActivityLogRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  retentionDays: number;
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Send one batch of activity events. Returns the number the server accepted. */
export async function reportActivityEvents(
  token: string,
  events: ActivityEventInput[],
  keepalive = false
): Promise<number> {
  if (!token || events.length === 0) return 0;
  const res = await fetch(`${API_BASE}/activity/events`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ events }),
    keepalive,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `访问流水上报失败（${res.status}）`);
  }
  return Number(body?.accepted) || 0;
}

/** Admin-only: query one student's recent activity. */
export async function getStudentActivity(
  token: string,
  studentId: number,
  query: ActivityLogQuery = {}
): Promise<ActivityListResponse> {
  const params = new URLSearchParams();
  params.set('days', String(query.days ?? 7));
  if (query.type) params.set('type', query.type);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 50));

  const res = await fetch(`${API_BASE}/activity/students/${studentId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `访问明细加载失败（${res.status}）`);
  }
  return body as ActivityListResponse;
}
