/**
 * Auth API Service
 * Handles authentication API calls
 */

const API_BASE = 'http://localhost:3000/api';

export interface User {
  id: number;
  studentId: string;
  name: string;
  role: 'student' | 'admin';
  classId?: number;
  class?: {
    id: number;
    name: string;
    grade: string;
  };
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
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
 * Logout
 */
export async function logout(token: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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