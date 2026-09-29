const API_BASE = 'http://localhost:3000/api';

export interface AnswerSheet {
  id: number;
  studentId: number;
  examId?: number | null;
  mockExamId?: number | null;
  wholePaperId?: number | null;
  fileUrl: string;
  fileType: 'image' | 'word';
  fileName?: string | null;
  annotations?: string | null;
  gradedFileUrl?: string | null;
  teacherComment?: string | null;
  totalScore?: number | null;
  gradedBy?: number | null;
  gradedAt?: string | null;
  status: 'submitted' | 'graded';
  createdAt: string;
  updatedAt: string;
  sceneTitle?: string;
  sceneType?: 'online_exam' | 'mock_exam' | 'whole_paper' | '';
  student?: { id: number; name: string; studentId: string };
}

export interface UploadResult {
  success: boolean;
  answerSheet?: AnswerSheet;
  error?: string;
}

export interface AnswerSheetsResult {
  success: boolean;
  answerSheets: AnswerSheet[];
  error?: string;
}

/**
 * 学生上传答题纸（图片或 Word）。同一场景重复上传会覆盖旧的。
 * @param token 学生令牌
 * @param file 答题纸文件
 * @param scene 三种场景之一
 */
export async function uploadAnswerSheet(
  token: string,
  file: File,
  scene: { examId?: number; mockExamId?: number; wholePaperId?: number }
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  if (scene.examId) fd.append('examId', String(scene.examId));
  if (scene.mockExamId) fd.append('mockExamId', String(scene.mockExamId));
  if (scene.wholePaperId) fd.append('wholePaperId', String(scene.wholePaperId));

  const res = await fetch(`${API_BASE}/answer-sheets/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '上传失败');
  return data;
}

/**
 * 老师上传批改版 Word 答题纸（离线批注后回传）
 */
export async function uploadGradedSheet(
  token: string,
  id: number,
  file: File
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('id', String(id));
  const res = await fetch(`${API_BASE}/answer-sheets/upload-graded`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '上传批改版失败');
  return data;
}

/** 学生查看自己的答题纸列表 */
export async function getMyAnswerSheets(token: string): Promise<AnswerSheetsResult> {
  const res = await fetch(`${API_BASE}/answer-sheets/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '查询失败');
  return data;
}

/** 老师查看待批改/已批改列表（status: 'submitted' | 'graded' | 'all'） */
export async function getPendingAnswerSheets(
  token: string,
  status: 'submitted' | 'graded' | 'all' = 'submitted'
): Promise<AnswerSheetsResult> {
  const res = await fetch(`${API_BASE}/answer-sheets/pending?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '查询失败');
  return data;
}

/** 查看单个答题纸（学生只看自己，老师可看任意） */
export async function getAnswerSheet(token: string, id: number): Promise<UploadResult> {
  const res = await fetch(`${API_BASE}/answer-sheets/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '查询失败');
  return data;
}

export interface GradingPayload {
  annotations?: any[];            // 批注数组：[{type:'rect',x,y,w,h,color,note?}, {type:'text',x,y,text,color}, {type:'pen',points:[{x,y}],color,size}, ...]
  totalScore?: number;
  teacherComment?: string;
}

/** 老师保存批改：批注+总分+评语 */
export async function gradeAnswerSheet(
  token: string,
  id: number,
  payload: GradingPayload
): Promise<UploadResult> {
  const res = await fetch(`${API_BASE}/answer-sheets/${id}/grade`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '批改失败');
  return data;
}

export async function deleteAnswerSheet(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/answer-sheets/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '删除失败');
}

/** 把后端 URL 转成完整 URL（如 /uploads/... → http://localhost:3000/uploads/...） */
export function normalizeSheetUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `http://localhost:3000${url}`;
}

/** 解析 annotations JSON */
export function parseAnnotations(raw?: string | null): any[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}