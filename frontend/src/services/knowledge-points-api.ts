/**
 * Knowledge Points API Service
 */

const API_BASE = 'http://localhost:3000/api';

export interface KnowledgePoint {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  level: number;
  masteryLevel: string;
  suggestedHours: number;
  description: string | null;
  children?: KnowledgePoint[];
}

export interface KnowledgePointRelation {
  id: number;
  sourceId: number;
  targetId: number;
  relationType: 'prerequisite' | 'related';
  source?: KnowledgePoint;
  target?: KnowledgePoint;
}

/**
 * Get all knowledge points
 */
export async function getKnowledgePoints(): Promise<KnowledgePoint[]> {
  const response = await fetch(`${API_BASE}/knowledge-points`);
  return response.json();
}

/**
 * Get knowledge point tree
 */
export async function getKnowledgePointTree(): Promise<KnowledgePoint[]> {
  const response = await fetch(`${API_BASE}/knowledge-points/tree/full`);
  return response.json();
}

/**
 * Get a single knowledge point
 */
export async function getKnowledgePoint(id: number): Promise<KnowledgePoint> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}`);
  return response.json();
}

/**
 * Create a knowledge point
 */
export async function createKnowledgePoint(
  data: Omit<KnowledgePoint, 'id' | 'children'>
): Promise<KnowledgePoint> {
  const response = await fetch(`${API_BASE}/knowledge-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

/**
 * Update a knowledge point
 */
export async function updateKnowledgePoint(
  id: number,
  data: Partial<KnowledgePoint>
): Promise<KnowledgePoint> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

/**
 * Delete a knowledge point
 * @param token auth token
 * @param id knowledge point ID
 * @param cascade if true, recursively delete all child knowledge points
 */
export async function deleteKnowledgePoint(
  token: string,
  id: number,
  cascade?: boolean
): Promise<{ success: boolean; deletedCount?: number; message?: string; error?: string }> {
  const url = `${API_BASE}/knowledge-points/${id}${cascade ? '?cascade=true' : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `删除失败 (${response.status})`);
  }
  return data;
}

/**
 * Get ancestors of a knowledge point
 */
export async function getAncestors(id: number): Promise<KnowledgePoint[]> {
  const response = await fetch(`${API_BASE}/knowledge-points/${id}/ancestors`);
  return response.json();
}

/**
 * Create a relation between knowledge points
 */
export async function createRelation(
  sourceId: number,
  targetId: number,
  relationType: 'prerequisite' | 'related'
): Promise<KnowledgePointRelation> {
  const response = await fetch(`${API_BASE}/knowledge-points/${sourceId}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, relationType }),
  });
  return response.json();
}

/**
 * Delete a relation
 */
export async function deleteRelation(
  sourceId: number,
  relationId: number
): Promise<void> {
  await fetch(`${API_BASE}/knowledge-points/${sourceId}/relations/${relationId}`, {
    method: 'DELETE',
  });
}