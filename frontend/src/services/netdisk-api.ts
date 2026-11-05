/**
 * Netdisk Binding API — /api/netdisk（百度网盘开放平台绑定与操作）
 */

const API_BASE = 'http://localhost:3000/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface NetdiskConfigStatus {
  configured: boolean;
  bound: boolean;
  hasAppKey: boolean;
  hasSignKey: boolean;
  accessTokenPreview?: string;
  netdiskUk?: number;
  tokenExpireAt?: string;
  status?: 'unconfigured' | 'unbound' | 'bound' | 'expired' | 'error';
  lastError?: string;
}

export interface NetdiskConfigInput {
  appKey: string;
  appSecret: string;
  signKey?: string;
}

export interface NetdiskFile {
  fsId: number;
  path: string;
  filename: string;
  isDir: number;
  size?: number;
  mtime?: number;
}

export interface NetdiskListResult {
  dir: string;
  files: NetdiskFile[];
}

export interface NetdiskShareResult {
  path: string;
  fsId: number;
  shareUrl?: string;
  error?: string;
}

export interface NetdiskDownloadResult {
  path: string;
  fsId: number;
  localPath?: string;
  fileUrl?: string;
  error?: string;
}

export async function getNetdiskStatus(token: string): Promise<NetdiskConfigStatus> {
  const res = await fetch(`${API_BASE}/netdisk/status`, { headers: authHeaders(token) });
  return res.json();
}

export async function saveNetdiskConfig(token: string, config: NetdiskConfigInput): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/netdisk/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getNetdiskAuthorizeUrl(token: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/netdisk/authorize-url`, { headers: authHeaders(token) });
  return res.json();
}

export async function unbindNetdisk(token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/netdisk/unbind`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json();
}

export async function listNetdiskFiles(token: string, dir?: string): Promise<NetdiskListResult> {
  const qs = dir ? `?dir=${encodeURIComponent(dir)}` : '';
  const res = await fetch(`${API_BASE}/netdisk/files${qs}`, { headers: authHeaders(token) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '获取目录失败');
  return d;
}

export async function createNetdiskShare(token: string, items: { fsId: number; path: string }[]): Promise<{ results: NetdiskShareResult[] }> {
  const res = await fetch(`${API_BASE}/netdisk/share`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '创建分享失败');
  return d;
}

export async function downloadNetdiskFile(token: string, items: { fsId: number; path: string }[]): Promise<{ results: NetdiskDownloadResult[] }> {
  const res = await fetch(`${API_BASE}/netdisk/download`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '下载失败');
  return d;
}
