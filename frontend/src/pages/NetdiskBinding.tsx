import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNetdiskStatus, saveNetdiskConfig, getNetdiskAuthorizeUrl, unbindNetdisk,
  listNetdiskFiles, createNetdiskShare, downloadNetdiskFile,
} from '../services/netdisk-api';
import type { NetdiskConfigStatus, NetdiskFile } from '../services/netdisk-api';
import './NetdiskBinding.css';

export default function NetdiskBinding() {
  const { token } = useAuth();
  const [status, setStatus] = useState<NetdiskConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [signKey, setSignKey] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const s = await getNetdiskStatus(token);
      setStatus(s);
    } catch (e: any) {
      setMessage('加载状态失败: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSaveConfig = async () => {
    if (!token || !appKey || !appSecret) {
      setMessage('请填写 AppKey 和 SecretKey');
      return;
    }
    setSaving(true);
    try {
      await saveNetdiskConfig(token, { appKey, appSecret, signKey: signKey || undefined });
      setMessage('凭证已保存');
      await loadStatus();
    } catch (e: any) {
      setMessage('保存失败: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    if (!token) return;
    try {
      const auRes: any = await getNetdiskAuthorizeUrl(token); const url = auRes.url || auRes.authorizeUrl;
      window.open(url, '_blank');
      setMessage('已打开授权页面，请在授权完成后回到此页面查看绑定状态（约 1 分钟）');
      // 轮询绑定状态
      const poll = setInterval(async () => {
        const s = await getNetdiskStatus(token);
        setStatus(s);
        if (s.bound) {
          clearInterval(poll);
          setMessage('绑定成功！');
        }
      }, 5000);
      setTimeout(() => clearInterval(poll), 120000);
    } catch (e: any) {
      setMessage('获取授权链接失败: ' + (e.message || e));
    }
  };

  const handleUnbind = async () => {
    if (!token) return;
    if (!window.confirm('确认解除绑定？')) return;
    try {
      await unbindNetdisk(token);
      setMessage('已解除绑定');
      await loadStatus();
    } catch (e: any) {
      setMessage('解绑失败: ' + (e.message || e));
    }
  };

  if (loading) return <div className="netdisk-binding"><p>加载中...</p></div>;

  const statusLabel: Record<string, string> = {
    unconfigured: '未配置凭证',
    unbound: '未绑定账号',
    bound: '已绑定',
    expired: 'Token 已过期',
    error: '连接异常',
  };
  const statusClass: Record<string, string> = {
    unconfigured: 'badge-gray',
    unbound: 'badge-yellow',
    bound: 'badge-green',
    expired: 'badge-red',
    error: 'badge-red',
  };

  return (
    <div className="netdisk-binding">
      <h1>☁️ 网盘绑定（百度网盘开放平台）</h1>
      {message && <div className="nd-message">{message}</div>}

      <div className="nd-card">
        <div className="nd-card-header">
          <h2>绑定状态</h2>
          <span className={`nd-badge ${statusClass[status?.status || 'unconfigured']}`}>
            {statusLabel[status?.status || 'unconfigured']}
          </span>
        </div>
        {status?.bound && (
          <div className="nd-info-grid">
            <div><label>网盘 UK</label><span>{status.netdiskUk}</span></div>
            <div><label>Token 到期</label><span>{status.tokenExpireAt ? new Date(status.tokenExpireAt).toLocaleString() : '-'}</span></div>
            <div><label>Access Token</label><span>{status.accessTokenPreview}...</span></div>
          </div>
        )}
      </div>

      <div className="nd-card">
        <h2>应用凭证</h2>
        <p className="nd-hint">在百度网盘开放平台（pan.baidu.com/union）创建「个人使用」应用后，将 AppKey / SecretKey / SignKey 填入：</p>
        <div className="nd-form">
          <div className="nd-form-row">
            <label>AppKey</label>
            <input type="text" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="KHWde24QlUVt4QeQZvhdYVhB" />
          </div>
          <div className="nd-form-row">
            <label>SecretKey</label>
            <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="应用 SecretKey" />
          </div>
          <div className="nd-form-row">
            <label>SignKey</label>
            <input type="password" value={signKey} onChange={(e) => setSignKey(e.target.value)} placeholder="可选（计算 sign 用）" />
          </div>
          <button className="nd-btn-primary" onClick={handleSaveConfig} disabled={saving}>
            {saving ? '保存中...' : '保存凭证'}
          </button>
        </div>
      </div>

      <div className="nd-card">
        <h2>账号授权</h2>
        {!status?.configured ? (
          <p className="nd-hint">请先保存应用凭证</p>
        ) : status?.bound ? (
          <div className="nd-actions">
            <button className="nd-btn-danger" onClick={handleUnbind}>解除绑定</button>
            <FileBrowser token={token!} />
          </div>
        ) : (
          <div>
            <p className="nd-hint">授权后系统将自动托管分享链接与教辅下载</p>
            <button className="nd-btn-primary" onClick={handleAuthorize}>🚀 去授权绑定</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FileBrowser({ token }: { token: string }) {
  const [show, setShow] = useState(false);
  const [dir, setDir] = useState('/apps/高中学习系统');
  const [files, setFiles] = useState<NetdiskFile[]>([]);
  const [selected, setSelected] = useState<Map<number, NetdiskFile>>(new Map());
  const [busy, setBusy] = useState('');

  const load = useCallback(async (d: string) => {
    try {
      const r = await listNetdiskFiles(token, d);
      setDir(r.dir);
      setFiles(r.files);
      setSelected(new Map());
    } catch (e: any) {
      alert('加载失败: ' + (e.message || e));
    }
  }, [token]);

  const toggleSelect = (f: NetdiskFile) => {
    const next = new Map(selected);
    if (next.has(f.fsId)) next.delete(f.fsId);
    else next.set(f.fsId, f);
    setSelected(next);
  };

  const handleShare = async () => {
    if (selected.size === 0) return;
    setBusy('正在创建分享...');
    try {
      const items = Array.from(selected.values()).map((f) => ({ fsId: Number(f.fsId), path: f.path }));
      const r = await createNetdiskShare(token, items);
      const ok = r.results.filter((x) => x.shareUrl).length;
      alert(`分享完成：成功 ${ok} 个，失败 ${r.results.length - ok} 个`);
    } finally {
      setBusy('');
    }
  };

  const handleDownload = async () => {
    if (selected.size === 0) return;
    setBusy('正在下载（大文件可能需要几分钟）...');
    try {
      const items = Array.from(selected.values()).map((f) => ({ fsId: Number(f.fsId), path: f.path }));
      const r = await downloadNetdiskFile(token, items);
      const ok = r.results.filter((x) => x.localPath).length;
      alert(`下载完成：成功 ${ok} 个，失败 ${r.results.length - ok} 个`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="nd-file-browser">
      <button className="nd-btn-secondary" onClick={() => { setShow(!show); if (!show) load(dir); }}>
        {show ? '收起目录浏览' : '📂 浏览网盘目录'}
      </button>
      {show && (
        <div className="nd-browser-panel">
          <div className="nd-browser-toolbar">
            <input type="text" value={dir} onChange={(e) => setDir(e.target.value)} />
            <button onClick={() => load(dir)}>进入</button>
            <button onClick={() => load(dir.split('/').slice(0, -1).join('/') || '/')} disabled={dir === '/'}>⬆ 上级</button>
            <span className="nd-selected-count">已选 {selected.size} 项</span>
            <button onClick={handleShare} disabled={selected.size === 0 || !!busy}>🔗 批量分享</button>
            <button onClick={handleDownload} disabled={selected.size === 0 || !!busy}>⬇ 批量下载</button>
          </div>
          {busy && <div className="nd-busy">{busy}</div>}
          <table className="nd-file-table">
            <thead>
              <tr><th></th><th>文件名</th><th>类型</th><th>大小</th></tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.fsId}>
                  <td><input type="checkbox" checked={selected.has(f.fsId)} onChange={() => toggleSelect(f)} /></td>
                  <td>
                    {f.isDir === 1 ? (
                      <a onClick={() => load(f.path)} className="nd-dir-link">📁 {f.filename}</a>
                    ) : (
                      <span>📄 {f.filename}</span>
                    )}
                  </td>
                  <td>{f.isDir === 1 ? '目录' : (f.filename.split('.').pop() || '').toLowerCase()}</td>
                  <td>{f.size ? (f.size / 1024 / 1024).toFixed(1) + ' MB' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
