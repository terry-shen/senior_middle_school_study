/**
 * 网盘资源索引与映射工作台 API — /api/netdisk-index
 */
const API_BASE = 'http://localhost:3000/api';

function H(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface ScanStatus {
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  currentDir: string | null;
  scannedDirs: number;
  totalFiles: number;
  queueLength: number;
  lastError: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

export interface IndexStats {
  total: number;
  mapped: number;
  unmapped: number;
  pinned: number;
  byKind: { key: string; count: number }[];
  byAudience: { key: string; count: number }[];
  bySection: { sectionId: number; title: string; count: number }[];
}

export interface AssetRow {
  id: number;
  fsId: string | null;
  path: string;
  name: string;
  ext: string | null;
  size: string | null;
  assetKind: string;
  audience: string;
  year: number | null;
  region: string | null;
  series: string | null;
  sectionId: number | null;
  mapSource: string;
  mapConfirmed: boolean;
  isPinned: boolean;
  status: string;
  candidateSections: string | null;
  section?: { id: number; title: string; chapter?: { title: string; textbook?: { name: string } } } | null;
}

export interface AssetListResult {
  data: AssetRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AssetFilters {
  sectionId?: number;
  unmapped?: boolean;
  assetKind?: string;
  audience?: string;
  status?: string;
  q?: string;
  mapConfirmed?: boolean;
  isPinned?: boolean;
  page?: number;
  limit?: number;
}

export async function startScan(token: string, restart = false): Promise<{ success: boolean; started: boolean; status: ScanStatus }> {
  const r = await fetch(`${API_BASE}/netdisk-index/scan`, { method: 'POST', headers: H(token), body: JSON.stringify({ restart }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '启动扫描失败');
  return d;
}

export async function remapAssets(token: string): Promise<{ success: boolean; scanned: number; mapped: number; perSection: number }> {
  const r = await fetch(`${API_BASE}/netdisk-index/remap`, { method: 'POST', headers: H(token) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '重新映射失败');
  return d;
}

export async function pauseScan(token: string): Promise<{ success: boolean; status: ScanStatus }> {
  const r = await fetch(`${API_BASE}/netdisk-index/scan/pause`, { method: 'POST', headers: H(token) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '暂停失败');
  return d;
}

export async function getScanStatus(token: string): Promise<{ success: boolean; status: ScanStatus }> {
  const r = await fetch(`${API_BASE}/netdisk-index/scan/status`, { headers: H(token) });
  return r.json();
}

export async function getIndexStats(token: string): Promise<IndexStats & { success: boolean }> {
  const r = await fetch(`${API_BASE}/netdisk-index/stats`, { headers: H(token) });
  return r.json();
}

export async function listAssets(token: string, f: AssetFilters = {}): Promise<AssetListResult & { success: boolean }> {
  const qs = new URLSearchParams();
  if (f.sectionId != null) qs.set('sectionId', String(f.sectionId));
  if (f.unmapped) qs.set('unmapped', '1');
  if (f.assetKind) qs.set('assetKind', f.assetKind);
  if (f.audience) qs.set('audience', f.audience);
  if (f.status) qs.set('status', f.status);
  if (f.q) qs.set('q', f.q);
  if (f.mapConfirmed !== undefined) qs.set('mapConfirmed', f.mapConfirmed ? '1' : '0');
  if (f.isPinned !== undefined) qs.set('isPinned', f.isPinned ? '1' : '0');
  qs.set('page', String(f.page ?? 1));
  qs.set('limit', String(f.limit ?? 50));
  const r = await fetch(`${API_BASE}/netdisk-index/assets?${qs.toString()}`, { headers: H(token) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '获取资源失败');
  return d;
}

export async function updateAsset(token: string, id: number, payload: Record<string, unknown>): Promise<{ success: boolean; data: AssetRow }> {
  const r = await fetch(`${API_BASE}/netdisk-index/assets/${id}`, { method: 'PATCH', headers: H(token), body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '更新失败');
  return d;
}

export type BatchAction = 'confirm' | 'move' | 'pin' | 'unpin' | 'archive' | 'restore' | 'ignore' | 'unmap';

export async function batchAction(token: string, ids: number[], action: BatchAction, sectionId?: number | null): Promise<{ success: boolean; affected: number }> {
  const r = await fetch(`${API_BASE}/netdisk-index/assets/batch`, {
    method: 'POST',
    headers: H(token),
    body: JSON.stringify({ ids, action, sectionId: sectionId ?? null }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '批量操作失败');
  return d;
}

export async function getConvergence(token: string, sectionIds: number[]): Promise<{ success: boolean; sections: { sectionId: number; pinned: number; more: number; total: number; ok: boolean }[] }> {
  const r = await fetch(`${API_BASE}/netdisk-index/convergence?sectionIds=${sectionIds.join(',')}`, { headers: H(token) });
  return r.json();
}
