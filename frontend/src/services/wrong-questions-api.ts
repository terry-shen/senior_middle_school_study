/**
 * 学生错题本 API 服务
 */

const API_BASE = 'http://localhost:3000/api';

export type WrongQuestionSource = 'photo' | 'manual';
export type ReviewStatus = 'new' | 'reviewing' | 'mastered';
export type ViewMode = 'unmastered' | 'all';

export interface StudentWrongQuestion {
  id: number;
  studentId: number;
  source: WrongQuestionSource;
  imageUrl?: string | null;
  content?: string | null;
  options?: string | null; // JSON 字符串数组
  myAnswer?: string | null;
  correctAnswer?: string | null;
  analysis?: string | null;
  questionType: string;
  difficulty: string;
  knowledgePointTags?: string | null;
  notes?: string | null;
  reviewStatus: ReviewStatus;
  wrongCount: number;
  createdAt: string;
  lastReviewAt?: string | null;
  updatedAt: string;
}

export interface WrongQuestionFilters {
  questionType?: string;
  difficulty?: string;
  tag?: string;
  reviewStatus?: string;
  viewMode?: ViewMode;
  sortBy?: 'createdAt' | 'lastReviewAt';
  page?: number;
  limit?: number;
}

export interface WrongQuestionsResult {
  data: StudentWrongQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MasteryGroup {
  tag: string;
  total: number;
  mastered: number;
  mastery: number;
  weak: boolean;
}

export interface MasteryOverview {
  overall: { total: number; mastered: number; mastery: number };
  groups: MasteryGroup[];
}

export interface PrintExportItem {
  index: number;
  id: number;
  questionType: string;
  difficulty: string;
  content?: string | null;
  imageUrl?: string | null;
  options?: string | null;
  knowledgePointTags?: string | null;
  myAnswer?: string | null;
  correctAnswer?: string | null;
  analysis?: string | null;
}

export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `http://localhost:3000${url}`;
}

export function parseOptions(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // ignore
  }
  return [];
}

// 创建手动录入错题
export async function createManualWrongQuestion(
  token: string,
  data: {
    content?: string;
    options?: string;
    myAnswer?: string;
    correctAnswer?: string;
    analysis?: string;
    questionType?: string;
    difficulty?: string;
    knowledgePointTags?: string;
    notes?: string;
  }
): Promise<{ success: boolean; wrongQuestion: StudentWrongQuestion }> {
  const response = await fetch(`${API_BASE}/wrong-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

// 拍照上传错题
export async function createPhotoWrongQuestion(
  token: string,
  file: File,
  metadata: {
    questionType?: string;
    difficulty?: string;
    knowledgePointTags?: string;
    myAnswer?: string;
    correctAnswer?: string;
    analysis?: string;
    notes?: string;
    content?: string;
  } = {}
): Promise<{ success: boolean; wrongQuestion: StudentWrongQuestion }> {
  const formData = new FormData();
  formData.append('image', file);
  for (const [k, v] of Object.entries(metadata)) {
    if (v !== undefined && v !== null) formData.append(k, String(v));
  }
  const response = await fetch(`${API_BASE}/wrong-questions/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.json();
}

// 列表查询
export async function getWrongQuestions(
  token: string,
  filters: WrongQuestionFilters = {}
): Promise<WrongQuestionsResult> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const response = await fetch(
    `${API_BASE}/wrong-questions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.json();
}

// 详情
export async function getWrongQuestionById(
  token: string,
  id: number
): Promise<StudentWrongQuestion> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// 更新
export async function updateWrongQuestion(
  token: string,
  id: number,
  data: Partial<Omit<StudentWrongQuestion, 'id' | 'studentId' | 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; wrongQuestion: StudentWrongQuestion }> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

// 删除
export async function deleteWrongQuestion(
  token: string,
  id: number
): Promise<{ success: boolean; deleted: number }> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// 重练自评
export async function practiceWrongQuestion(
  token: string,
  id: number,
  selfAssessment: 'correct' | 'wrong',
  userAnswer?: string
): Promise<{ success: boolean; wrongQuestion: StudentWrongQuestion }> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}/practice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selfAssessment, userAnswer }),
  });
  return response.json();
}

// 标记/取消掌握
export async function setMastered(
  token: string,
  id: number,
  mastered: boolean
): Promise<{ success: boolean; wrongQuestion: StudentWrongQuestion }> {
  const response = await fetch(`${API_BASE}/wrong-questions/${id}/mastered`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mastered }),
  });
  return response.json();
}

// 掌握度概览
export async function getMasteryOverview(
  token: string
): Promise<MasteryOverview> {
  const response = await fetch(`${API_BASE}/wrong-questions/mastery-overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// 打印导出数据
export async function getPrintExportData(
  token: string,
  ids: number[],
  includeAnswerAnalysis: boolean = false
): Promise<{ success: boolean; items: PrintExportItem[] }> {
  const params = new URLSearchParams({
    ids: ids.join(','),
    includeAnswerAnalysis: String(includeAnswerAnalysis),
  });
  const response = await fetch(
    `${API_BASE}/wrong-questions/print-export?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.json();
}
