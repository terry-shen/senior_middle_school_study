/**
 * Subjects API — 学科字典（公开端点）+ 全局当前学科状态
 *
 * 全局学科切换器将选中学科写入本模块（并持久化到 localStorage），
 * 各 list 类 API 函数通过 withSubjectParam() 隐式附加 subjectId 查询参数。
 */
const API_BASE = 'http://localhost:3000/api';

export interface Subject {
  id: number;
  code: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  order: number;
  isActive: boolean;
}

// 模块级当前学科（从 localStorage 恢复，SubjectContext 负责校验与同步）
let currentSubjectId: number | null = (() => {
  try {
    const raw = localStorage.getItem('selectedSubjectId');
    if (raw) {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch { /* SSR/测试环境无 localStorage */ }
  return null;
})();

export function getSelectedSubjectId(): number | null {
  return currentSubjectId;
}

export function setSelectedSubjectId(id: number | null) {
  currentSubjectId = id;
  try {
    if (id == null) localStorage.removeItem('selectedSubjectId');
    else localStorage.setItem('selectedSubjectId', String(id));
  } catch { /* ignore */ }
}

/** 给 URL 附加当前学科过滤参数（选「全部」时不附加 → 后端返回全部） */
export function withSubjectParam(url: string): string {
  if (currentSubjectId == null) return url;
  return `${url}${url.includes('?') ? '&' : '?'}subjectId=${currentSubjectId}`;
}

/** 学科列表（公开，无需登录） */
export async function getSubjects(): Promise<Subject[]> {
  const res = await fetch(`${API_BASE}/subjects`);
  if (!res.ok) throw new Error('加载学科列表失败');
  return res.json();
}

/** 学科管理：新增（admin） */
export async function createSubject(
  token: string,
  data: { code: string; name: string; icon?: string; color?: string; order?: number }
): Promise<Subject> {
  const res = await fetch(`${API_BASE}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '创建学科失败');
  return json;
}

/** 学科管理：编辑（admin，code 不可改） */
export async function updateSubject(
  token: string,
  id: number,
  data: { name?: string; icon?: string | null; color?: string | null; order?: number; isActive?: boolean }
): Promise<Subject> {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || '更新学科失败');
  return json;
}

/** 学科管理：删除（admin，有关联数据返回 409） */
export async function deleteSubject(token: string, id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error || '删除学科失败') as Error & { statusCode?: number };
    err.statusCode = res.status;
    throw err;
  }
  return json;
}

/** 学科管理：关联数据统计（admin） */
export async function getSubjectUsage(
  token: string,
  id: number
): Promise<{ papers: number; questions: number; examSessions: number; wrongQuestions: number; knowledgePoints: number; total: number }> {
  const res = await fetch(`${API_BASE}/subjects/${id}/usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('查询学科使用情况失败');
  return res.json();
}
