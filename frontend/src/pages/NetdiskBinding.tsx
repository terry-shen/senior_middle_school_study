import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNetdiskStatus, saveNetdiskConfig, getNetdiskAuthorizeUrl, unbindNetdisk,
} from '../services/netdisk-api';
import type { NetdiskConfigStatus } from '../services/netdisk-api';
import NetdiskBrowser from '../components/NetdiskBrowser';
import './NetdiskBinding.css';

export default function NetdiskBinding() {
  const { token } = useAuth();
  const [status, setStatus] = useState<NetdiskConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [signKey, setSignKey] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const s = await getNetdiskStatus(token);
      setStatus(s);
      // 回填已保存凭证（admin-only 接口返回明文，便于查看/修改）
      if (s.appKey) setAppKey(s.appKey);
      if (s.appSecret) setAppSecret(s.appSecret);
      if (s.signKey) setSignKey(s.signKey);
      if (s.redirectUri) setRedirectUri(s.redirectUri);
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
      await saveNetdiskConfig(token, { appKey, appSecret, signKey: signKey || undefined, redirectUri: redirectUri || undefined });
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
    unbound: '凭证已保存 · 待授权',
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
        <p className="nd-hint">在百度网盘开放平台（pan.baidu.com/union）创建「个人使用」应用后，将 AppKey / SecretKey / SignKey 填入并保存（保存后刷新页面会自动回填）：</p>
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
            <input type="password" value={signKey} onChange={(e) => setSignKey(e.target.value)} placeholder="可选，仅在后台开启 sign 校验时需要" />
          </div>
          <div className="nd-form-row">
            <label>授权回调页</label>
            <input type="text" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="留空使用默认 /api/netdisk/callback" />
          </div>
        </div>
        <div className="nd-callback-notice">
          <strong>⚠️ 关键：授权前必须完成此步骤</strong>
          <p>到百度开放平台（pan.baidu.com/union）→ 应用管理 → 安全设置 → <strong>授权回调页</strong>，把下方地址<strong>原样</strong>添加进去（每行一条，必须与之一字不差，含 http:// 和端口）：</p>
          <div className="nd-callback-box">
            <code>{status?.redirectUri || '/api/netdisk/callback'}</code>
            <button type="button" className="btn-sm" onClick={() => {
              const uri = status?.redirectUri || '/api/netdisk/callback';
              navigator.clipboard?.writeText(uri).then(() => setMessage('回调地址已复制到剪贴板'));
            }}>复制</button>
          </div>
          <p className="nd-callback-err">配置不一致会导致点击授权时报「redirect_uri_mismatch」。</p>
        </div>
        <button className="nd-btn-primary" onClick={handleSaveConfig} disabled={saving}>
          {saving ? '保存中...' : '保存凭证'}
        </button>
      </div>

      <div className="nd-card">
        <h2>账号授权</h2>
        {!status?.configured ? (
          <p className="nd-hint">请先保存应用凭证</p>
        ) : status?.bound ? (
          <div className="nd-actions">
            <button className="nd-btn-danger" onClick={handleUnbind}>解除绑定</button>
            <NetdiskBrowser token={token!} allSubjects />
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
