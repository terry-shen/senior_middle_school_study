import { useState, useEffect, useCallback } from 'react';
import { listNetdiskFiles, getNetdiskStatus } from '../services/netdisk-api';
import type { NetdiskFile } from '../services/netdisk-api';
import { importResources } from '../services/video-library-api';
import './NetdiskBrowser.css';

interface Props {
  token: string;
  canImport: boolean;
  onImported?: () => void;
}

const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'm3u8', 'rmvb', 'wmv'];
const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'];

function extIcon(f: NetdiskFile): string {
  if (f.isDir === 1) return '📁';
  const ext = (f.filename.split('.').pop() || '').toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return '🎬';
  if (DOC_EXTS.includes(ext)) return '📄';
  return '📎';
}

function fmtSize(size?: number | string): string {
  const n = typeof size === 'string' ? parseInt(size) : size;
  if (!n) return '-';
  if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024).toFixed(0) + ' KB';
}

export default function NetdiskBrowser({ token, canImport, onImported }: Props) {
  const [bound, setBound] = useState<boolean | null>(null);
  const [dir, setDir] = useState('/apps/高中学习系统');
  const [files, setFiles] = useState<NetdiskFile[]>([]);
  const [selected, setSelected] = useState<Map<number, NetdiskFile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [importResult, setImportResult] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getNetdiskStatus(token).then((s) => setBound(!!s.bound)).catch(() => setBound(false));
  }, [token]);

  const load = useCallback(async (d: string) => {
    if (!token) return;
    setLoading(true);
    setImportResult('');
    try {
      const r = await listNetdiskFiles(token, d);
      setDir(r.dir || d);
      setFiles(r.files || []);
      setSelected(new Map());
    } catch (e: any) {
      setImportResult('⚠️ ' + (e.message || '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (bound) load(dir); // eslint-disable-line react-hooks/exhaustive-deps
  }, [bound]);

  const crumbs = dir.split('/').filter(Boolean);
  const crumbPath = (i: number) => '/' + crumbs.slice(0, i + 1).join('/');

  const toggleSelect = (f: NetdiskFile) => {
    const next = new Map(selected);
    if (next.has(f.fsId)) next.delete(f.fsId);
    else next.set(f.fsId, f);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === files.filter((f) => f.isDir !== 1).length) {
      setSelected(new Map());
    } else {
      const m = new Map<number, NetdiskFile>();
      files.filter((f) => f.isDir !== 1).forEach((f) => m.set(f.fsId, f));
      setSelected(m);
    }
  };

  const handleImport = async () => {
    if (selected.size === 0 || !canImport) return;
    setBusy('正在导入（含自动分享/下载，大文件可能耗时较长）...');
    setImportResult('');
    try {
      const items = Array.from(selected.values()).map((f) => ({
        fsId: Number(f.fsId),
        path: f.path,
        size: f.size,
      }));
      const r = await importResources(token, items, { downloadDocuments: true });
      const failed = r.shareFailed.length + r.downloadFailed.length;
      setImportResult(
        `✅ 导入完成：新建 ${r.created} / 跳过 ${r.skipped}` +
        (r.shareFailed.length ? ` / 分享失败 ${r.shareFailed.length}` : '') +
        (r.downloadFailed.length ? ` / 下载失败 ${r.downloadFailed.length}` : '') +
        (r.success && !failed ? '' : '（部分操作失败，详见资源管理页）')
      );
      setSelected(new Map());
      onImported?.();
    } catch (e: any) {
      setImportResult('⚠️ 导入失败：' + (e.message || e));
    } finally {
      setBusy('');
    }
  };

  if (bound === null) return null;
  if (!bound) {
    return (
      <div className="netdisk-browser nb-not-bound">
        ☁️ 网盘未绑定 — 请先让管理员到「系统设置 → ☁️ 网盘绑定」完成授权后，即可浏览网盘资源清单。
      </div>
    );
  }

  return (
    <div className="netdisk-browser">
      <div className="nb-head">
        <span className="nb-title">☁️ 网盘资源</span>
        <span className="nb-dir-badge" title={dir}>{dir}</span>
        <button className="nb-btn" onClick={() => load(dir)} disabled={loading}>🔄 刷新</button>
        <button className="nb-btn nb-btn-collapse" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '展开 ▾' : '收起 ▴'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* 面包屑 */}
          <div className="nb-crumbs">
            <a onClick={() => load('/')}>根目录</a>
            {crumbs.map((c, i) => (
              <span key={i} className="nb-crumb">
                <span className="nb-sep">/</span>
                {i === crumbs.length - 1 ? <b>{c}</b> : <a onClick={() => load(crumbPath(i))}>{c}</a>}
              </span>
            ))}
            <button className="nb-btn nb-btn-up" onClick={() => load(crumbPath(crumbs.length - 2) || '/')} disabled={crumbs.length === 0}>
              ⬆ 上级
            </button>
          </div>

          {canImport && (
            <div className="nb-toolbar">
              <label className="nb-check-all">
                <input type="checkbox" onChange={toggleAll} checked={selected.size > 0 && selected.size === files.filter((f) => f.isDir !== 1).length} />
                全选（{selected.size}）
              </label>
              <button className="nb-btn nb-btn-primary" onClick={handleImport} disabled={selected.size === 0 || !!busy}>
                📥 批量导入资源库（{selected.size}）
              </button>
              {busy && <span className="nb-busy">{busy}</span>}
            </div>
          )}

          {importResult && <div className="nb-import-result">{importResult}</div>}

          {loading ? (
            <div className="nb-loading">加载中...</div>
          ) : files.length === 0 ? (
            <div className="nb-empty">该目录为空</div>
          ) : (
            <table className="nb-table">
              <thead>
                <tr>
                  {canImport && <th className="nb-col-check"></th>}
                  <th>名称</th>
                  <th className="nb-col-size">大小</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.fsId} className={f.isDir === 1 ? 'nb-row-dir' : ''}>
                    {canImport && (
                      <td className="nb-col-check">
                        {f.isDir !== 1 && <input type="checkbox" checked={selected.has(f.fsId)} onChange={() => toggleSelect(f)} />}
                      </td>
                    )}
                    <td className="nb-col-name">
                      {f.isDir === 1 ? (
                        <a className="nb-dir-link" onClick={() => load(f.path)} title={f.path}>
                          {extIcon(f)} {f.filename}
                        </a>
                      ) : (
                        <span title={f.path}>{extIcon(f)} {f.filename}</span>
                      )}
                    </td>
                    <td className="nb-col-size">{f.isDir === 1 ? '-' : fmtSize(f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
