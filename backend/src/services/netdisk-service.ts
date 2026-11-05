/**
 * Netdisk Integration Service — 百度网盘开放平台官方 API
 * Docs: https://pan.baidu.com/union
 */
import { PrismaClient } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ============ 类型 ============
export interface NetdiskConfigRow {
  id: number;
  appKey: string;
  appSecret: string;
  signKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpireAt: Date | null;
  netdiskUk: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NetdiskApiError { error_code: number; error_msg: string }
interface TokenResponse {
  access_token: string; expires_in: number;
  refresh_token?: string; scope?: string;
  error?: string; error_description?: string;
}
interface ShareResponse {
  shareid?: number; ctime?: number; link?: string;
  error?: string; error_description?: string;
  [key: string]: unknown;
}

const isApiErr = (d: unknown): d is NetdiskApiError =>
  !!d && typeof d === 'object' && 'error_code' in (d as Record<string, unknown>);

// ============ 模块级刷新锁 ============
let refreshPromise: Promise<void> | null = null;

// ============ 基础 ============
const CONF_ID = 1;

export async function getConfig(): Promise<NetdiskConfigRow | null> {
  return prisma.netdiskConfig.findUnique({ where: { id: CONF_ID } }) as Promise<NetdiskConfigRow | null>;
}

export async function saveConfig(appKey: string, appSecret: string, signKey?: string | null) {
  return prisma.netdiskConfig.upsert({
    where: { id: CONF_ID },
    update: { appKey, appSecret, signKey: signKey ?? null, accessToken: null, refreshToken: null, tokenExpireAt: null, netdiskUk: null, status: 'unbound' },
    create: { id: CONF_ID, appKey, appSecret, signKey: signKey ?? null, status: 'unbound' },
  });
}

export async function getStatus() {
  const c = await getConfig();
  const base = {
    configured: !!c,
    bound: c?.status === 'bound',
    hasAppKey: !!c?.appKey,
    hasAppSecret: !!c?.appSecret,
    hasSignKey: !!c?.signKey,
    appKey: c?.appKey ?? null,
    appSecret: c?.appSecret ?? null,
    signKey: c?.signKey ?? null,
    netdiskUk: c?.netdiskUk ?? null,
    tokenExpireAt: c?.tokenExpireAt ?? null,
    accessTokenPreview: c?.accessToken ? `${c.accessToken.slice(0, 8)}...(${c.accessToken.length}字符)` : null,
  };
  if (!c) return { status: 'unconfigured' as const, ...base };
  return { status: c.status as 'unbound' | 'bound' | 'expired' | 'error', ...base };
}

export async function unbind() {
  await prisma.netdiskConfig.update({
    where: { id: CONF_ID },
    data: { accessToken: null, refreshToken: null, tokenExpireAt: null, netdiskUk: null, status: 'unbound' },
  });
  return { success: true };
}

// ============ OAuth ============
export function buildAuthorizeUrl(redirectUri: string): string {
  return `https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id={appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=basic,netdisk`;
}

export async function handleCallback(code: string, redirectUri: string) {
  const c = await getConfig();
  if (!c) throw Object.assign(new Error('未配置应用凭证'), { statusCode: 400 });
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code,
    client_id: c.appKey, client_secret: c.appSecret,
    redirect_uri: redirectUri,
  }).toString();
  const { data } = await axios.post<TokenResponse>('https://openapi.baidu.com/oauth/2.0/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000,
  });
  if (data.error) throw new Error(`授权失败: ${data.error} ${data.error_description || ''}`);
  const expireAt = new Date(Date.now() + (data.expires_in - 3600) * 1000);
  let uk: string | null = null;
  try {
    const u = await axios.get('https://pan.baidu.com/rest/2.0/xpan/nas', {
      params: { access_token: data.access_token, method: 'uinfo' }, timeout: 15000,
    });
    uk = String(u.data?.uk ?? '');
  } catch { /* ignore */ }
  await prisma.netdiskConfig.update({
    where: { id: CONF_ID },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      tokenExpireAt: expireAt,
      netdiskUk: uk,
      status: 'bound',
    },
  });
  return { success: true, expiresIn: data.expires_in };
}

// ============ Token 链式刷新 ============
export async function ensureToken(): Promise<string> {
  const c = await getConfig();
  if (!c) throw Object.assign(new Error('未配置应用凭证'), { statusCode: 400 });
  if (!c.accessToken) throw Object.assign(new Error('网盘账号未绑定'), { statusCode: 400 });
  const expireAt = c.tokenExpireAt?.getTime() ?? 0;
  if (Date.now() < expireAt - 3600_000) return c.accessToken;
  if (refreshPromise) { await refreshPromise; const r = await getConfig(); if (r?.accessToken) return r.accessToken; throw new Error('刷新失败'); }
  refreshPromise = (async () => {
    if (!c.refreshToken) throw new Error('refresh_token 不存在，需重新绑定');
    const body = new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: c.refreshToken,
      client_id: c.appKey, client_secret: c.appSecret,
    }).toString();
    const { data } = await axios.post<TokenResponse>('https://openapi.baidu.com/oauth/2.0/token', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000,
    });
    if (data.error) throw new Error(`刷新失败: ${data.error}`);
    const expireAt2 = new Date(Date.now() + (data.expires_in - 3600) * 1000);
    // 先存新 refresh_token（链式单次有效）
    await prisma.netdiskConfig.update({
      where: { id: CONF_ID },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        tokenExpireAt: expireAt2,
        status: 'bound',
      },
    });
  })();
  try { await refreshPromise; } finally { refreshPromise = null; }
  const r = await getConfig();
  if (!r?.accessToken) throw new Error('刷新后无 token');
  return r.accessToken;
}

async function apiGet(url: string, params: Record<string, string | number>, _config: NetdiskConfigRow) {
  const token = await ensureToken();
  return axios.get(url, { params: { ...params, access_token: token }, timeout: 30000 });
}

// ============ 目录浏览 ============
export interface NetdiskFileEntry {
  fsId: number; path: string; name: string; isDir: boolean;
  size: number; modifyTime: string;
}
interface XpanListResponse { list?: { fs_id: number; path: string; server_filename: string; isdir: number; size: number; local_mtime: number }[]; error?: string; error_description?: string }

export async function listFiles(dir: string): Promise<NetdiskFileEntry[]> {
  const c = await getConfig();
  if (!c) throw Object.assign(new Error('未配置应用凭证'), { statusCode: 400 });
  if (!c.accessToken) throw Object.assign(new Error('网盘账号未绑定'), { statusCode: 400 });
  const token = await ensureToken();
  const appName = '高中学习系统';
  const fullDir = dir.startsWith(`/apps/${appName}`) ? dir : `/apps/${appName}`;
  const { data } = await axios.get<XpanListResponse>('https://pan.baidu.com/rest/2.0/xpan/file', {
    params: { method: 'list', dir: fullDir, access_token: token, order: 'name', desc: 0, limit: 200 },
    timeout: 30000,
  });
  if (data.error) throw new Error(`目录浏览失败: ${data.error} ${data.error_description || ''}`);
  return (data.list ?? []).map(f => ({
    fsId: Number(f.fs_id), path: f.path, name: f.server_filename,
    isDir: f.isdir === 1, size: f.size, modifyTime: new Date(f.local_mtime * 1000).toISOString(),
  }));
}

// ============ 分享生成 ============
export async function createShare(fsIds: number[]) {
  const c = await getConfig();
  if (!c?.accessToken) throw Object.assign(new Error('网盘账号未绑定'), { statusCode: 400 });
  const token = await ensureToken();
  const body = new URLSearchParams({ fid_list: JSON.stringify(fsIds), access_token: token, schannel: '0' }).toString();
  const { data } = await axios.post<ShareResponse>('https://pan.baidu.com/rest/2.0/xpan/share', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000,
  });
  if (data.error) throw new Error(`分享失败: ${data.error} ${(data as { error_description?: string }).error_description || ''}`);
  return { shareId: data.shareid, shareUrl: data.link ?? null };
}

// ============ 下载到本地 ============
const TEACHING_DIR = 'uploads/teaching-materials';

export async function saveLocalFile(fsId: number, filename: string) {
  const c = await getConfig();
  if (!c?.accessToken) throw Object.assign(new Error('网盘账号未绑定'), { statusCode: 400 });
  const token = await ensureToken();
  const meta = await axios.get('https://pan.baidu.com/rest/2.0/xpan/multimedia', {
    params: { method: 'filemetas', access_token: token, fsids: `[${fsId}]`, dlink: 1 }, timeout: 15000,
  });
  const file = meta.data?.list?.[0];
  if (!file) throw new Error('网盘文件不存在');
  if (!file.path.startsWith('/apps/')) throw Object.assign(new Error('该文件不在应用可访问目录，请先移动到 /apps/{appname}'), { statusCode: 400 });
  const dlink: string = file.dlink;
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.resolve(TEACHING_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safeName = filename.replace(/[^\w.\-\u4e00-\u9fff]/g, '_');
  const localPath = path.join(dir, safeName);
  const { data: fileData } = await axios.get(dlink, {
    headers: { 'User-Agent': 'pan.baidu.com', 'Referer': 'https://pan.baidu.com/' },
    responseType: 'stream', timeout: 600000, maxContentLength: Infinity, maxBodyLength: Infinity,
  });
  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(localPath);
    fileData.pipe(ws);
    ws.on('finish', () => resolve());
    ws.on('error', reject);
  });
  return { fileUrl: `/uploads/teaching-materials/${safeName}`, size: fs.statSync(localPath).size };
}

// ============ 签名（备用） ============
export function calcSign(params: Record<string, string | number>, secret: string) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('md5').update(sorted + secret).digest('hex').toUpperCase();
}
