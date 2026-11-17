const API_BASE = '/api';

export interface ApkInfo {
  success: boolean;
  found: boolean;
  name?: string;
  fsId?: string;
  size?: string | null;
  updatedAt?: string | null;
}

export async function getApkInfo(token: string): Promise<ApkInfo> {
  const res = await fetch(`${API_BASE}/netdisk/apk/info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('获取安装包信息失败');
  return res.json();
}

/** 浏览器直接导航下载，需用 query token（导航请求无法带 Authorization 头） */
export function apkDownloadUrl(token: string): string {
  return `${API_BASE}/netdisk/apk?token=${encodeURIComponent(token)}`;
}
