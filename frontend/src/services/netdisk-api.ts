/**
 * Netdisk Binding API — /api/netdisk（百度网盘开放平台绑定与操作）
 */

import { withSubjectParam } from './subjects-api';

const API_BASE = 'http://localhost:3000/api';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface NetdiskConfigStatus {
  status: 'unconfigured' | 'unbound' | 'bound' | 'expired' | 'error';
  configured: boolean;
  bound: boolean;
  hasAppKey?: boolean;
  hasAppSecret?: boolean;
  hasSignKey?: boolean;
  appKey?: string | null;
  appSecret?: string | null;
  signKey?: string | null;
  redirectUri?: string | null;
  netdiskUk?: string | null;
  tokenExpireAt?: string | null;
  accessTokenPreview?: string | null;
}

export interface NetdiskConfigInput {
  appKey: string;
  appSecret: string;
  signKey?: string;
  redirectUri?: string;
}

export interface NetdiskFile {
  fsId: number;
  path: string;
  name?: string; // 后端返回的显示名
  filename: string; // 规范化：接口返回时由 name 兜底填充
  isDir: number;
  size?: number | string;
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

/** 学生端可用：只返回是否已绑定，不含凭证 */
export async function getNetdiskPublicStatus(token: string): Promise<{ success: boolean; bound: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/netdisk/status/public`, { headers: authHeaders(token) });
  if (!res.ok) return { success: false, bound: false, status: 'unknown' };
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

export async function listNetdiskFiles(token: string, dir?: string, opts?: { allSubjects?: boolean }): Promise<NetdiskListResult> {
  const base = `${API_BASE}/netdisk/files?dir=${encodeURIComponent(dir || '/')}`;
  const url = opts?.allSubjects ? base : withSubjectParam(base);
  const res = await fetch(url, { headers: authHeaders(token) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '获取目录失败');
  // 规范化：filename 兜底用 name（后端返回 name 字段）
  if (Array.isArray(d.files)) {
    d.files = d.files.map((f: any) => ({ ...f, filename: f.filename || f.name || f.path?.split('/').pop() || '' }));
  }
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
