const API_BASE = '/api';

export interface AiAssistant {
  id: number;
  code: string;
  name: string;
  url: string;
  icon: string | null;
  description: string | null;
  order: number;
}

async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error || '请求失败');
  return data as T;
}

export function listAiAssistants(token: string) {
  return req<{ success: boolean; data: AiAssistant[] }>(token, '/ai-assistants');
}

export interface AiAssistantInput {
  name?: string;
  url?: string;
  icon?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

export function updateAiAssistant(token: string, id: number, payload: AiAssistantInput) {
  return req<{ success: boolean; assistant: AiAssistant }>(token, `/ai-assistants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
