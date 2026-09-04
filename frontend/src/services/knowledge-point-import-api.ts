const API_BASE = 'http://localhost:3000/api';

export interface KPDocument {
  id: number;
  name: string;
  contentMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Upload Word document (.docx/.doc) and convert to KP document.
 * Backend parses via mammoth and creates a KnowledgePoint record.
 */
export async function uploadWordDocument(token: string, file: File): Promise<{ success: boolean; doc: KPDocument }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/knowledge-points/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

/** List all KP documents */
export async function getKpDocuments(token: string): Promise<KPDocument[]> {
  const response = await fetch(`${API_BASE}/knowledge-points`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to load documents');
  return response.json();
}

/** Get single KP document */
export async function getKpDocument(token: string, id: number): Promise<KPDocument> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to load document');
  return response.json();
}

/** Update KP document (name and/or contentMarkdown) */
export async function updateKpDocument(token: string, id: number, data: { name?: string; contentMarkdown?: string }): Promise<KPDocument> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(err.error || 'Update failed');
  }
  return response.json();
}

/** Delete KP document */
export async function deleteKpDocument(token: string, id: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Delete failed');
  return response.json();
}

/** Create new empty KP document */
export async function createKpDocument(token: string, name: string, contentMarkdown?: string): Promise<KPDocument> {
  const response = await fetch(`${API_BASE}/knowledge-points`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, contentMarkdown }),
  });
  if (!response.ok) throw new Error('Create failed');
  return response.json();
}
