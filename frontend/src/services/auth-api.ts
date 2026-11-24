/**
 * Auth API Service
 * Handles authentication API calls
 */

const API_BASE = '/api';

export interface User {
  id: number;
  studentId: string;
  name: string;
  role: 'student' | 'admin';
  classId?: number;
  aiAssistantEnabled?: boolean;
  class?: {
    id: number;
    name: string;
    grade: string;
  };
}

export type LogoutReason = 'manual' | 'idle' | 'expired' | 'remote';

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  loginAt?: string;
  error?: string;
}

export interface ClassInfo {
  id: number;
  name: string;
  grade: string;
}

/**
 * Register a new student
 * Note: backend returns { success, student, token } - we adapt `student` -> `user`
 */
export async function register(
  studentId: string,
  name: string,
  password: string,
  classId: number
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId,
      name,
      password,
      classId,
      role: 'student',
    }),
  });
  const data = await response.json();
  // Adapt backend `student` field -> frontend `user` field
  if (data.student && !data.user) {
    data.user = data.student;
  }
  return data;
}

/**
 * Login
 * Note: backend returns { success, student, token } - we adapt `student` -> `user`
 */
export async function login(
  studentId: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, password }),
  });
  const data = await response.json();
  // Adapt backend `student` field -> frontend `user` field
  if (data.student && !data.user) {
    data.user = data.student;
  }
  return data;
}

/**
 * Get current user info
 * Note: backend returns { success, student } - we adapt `student` -> `user`
 */
export async function getCurrentUser(token: string): Promise<{ user?: User; error?: string }> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  // Adapt backend `student` field -> frontend `user` field
  if (data.student && !data.user) {
    data.user = data.student;
  }
  return data;
}

/**
 * Logout. The reason is recorded for the usage report.
 */
export async function logout(
  token: string,
  reason: LogoutReason = 'manual'
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return response.json();
}

export interface HeartbeatResponse {
  success: boolean;
  activeSec?: number;
  countedSec?: number;
  code?: string;
  error?: string;
}

/**
 * Presence/activity heartbeat. active=true is rate-limited by the caller.
 * keepalive lets pagehide send one last presence signal.
 */
export async function heartbeat(
  token: string,
  active: boolean,
  keepalive = false
): Promise<HeartbeatResponse> {
  const response = await fetch(`${API_BASE}/auth/heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ active }),
    keepalive,
  });
  if (!response.ok) {
    return { success: false, code: String(response.status) };
  }
  return response.json();
}

/**
 * Get all classes (for dropdown)
 * Uses public /list endpoint (no auth required) so registration page can call it
 */
export async function getClasses(): Promise<ClassInfo[]> {
  const response = await fetch(`${API_BASE}/classes/list`);
  const data = await response.json();
  // Public list endpoint returns { classes: [...] } or array
  if (Array.isArray(data)) {
    return data;
  }
  return data.classes || [];
}