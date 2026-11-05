import { useState, useEffect, useCallback } from 'react';
import { listNetdiskFiles, getNetdiskStatus } from '../services/netdisk-api';
import type { NetdiskFile } from '../services/netdisk-api';
import './NetdiskBrowser.css';

const API_BASE = 'http://localhost:3000/api';

interface Props {
  token: string;
}

const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'm3u8', 'rmvb', 'wmv'];
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'];

function extOf(f: NetdiskFile): string {
  return (f.filename.split('.').pop() || '').toLowerCase();
}

function extIcon(f: NetdiskFile): string {
  if (f.isDir === 1) return '📁';
  const ext = extOf(f);
  if (VIDEO_EXTS.includes(ext)) return '🎬';
  if (IMG_EXTS.includes(ext)) return '🖼️';
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

type Viewer =
  | { kind: 'video'; f: NetdiskFile }
  | { kind: 'image'; f: NetdiskFile }
  | { kind: 'doc'; f: NetdiskFile };

export default function NetdiskBrowser({ token }: Props) {
  const [bound, setBound] = useState<boolean | null>(null);
  const [dir, setDir] = useState('/apps/高中学习系统');
  const [files, setFiles] = useState<NetdiskFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [inlineDoc, setInlineDoc] = useState<NetdiskFile | null>(null);

  useEffect(() => {
    getNetdiskStatus(token).then((s) => setBound(!!s.bound)).catch(() => setBound(false));
  }, [token]);

  const load = useCallback(async (d: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const r = await listNetdiskFiles(token, d);
      setDir(r.dir || d);
      setFiles(r.files || []);
    } catch (e: any) {
      setError('⚠️ ' + (e.message || '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (bound) load(dir); // eslint-disable-line react-hooks/exhaustive-deps
  }, [bound]);

  const crumbs = dir.split('/').filter(Boolean);
  const crumbPath = (i: number) => '/' + crumbs.slice(0, i + 1).join('/');

  const streamUrl = (f: NetdiskFile) => `${API_BASE}/netdisk/stream?fsId=${f.fsId}&token=${encodeURIComponent(token)}`;
  const fileUrl = (f: NetdiskFile, mode: 'inline' | 'attachment') =>
    `${API_BASE}/netdisk/file?fsId=${f.fsId}&mode=${mode}&token=${encodeURIComponent(token)}`;

  const openFile = (f: NetdiskFile) => {
    const ext = extOf(f);
    if (VIDEO_EXTS.includes(ext)) setViewer({ kind: 'video', f });
    else if (IMG_EXTS.includes(ext)) setViewer({ kind: 'image', f });
    else setViewer({ kind: 'doc', f });
  };

  const closeViewer = () => setViewer(null);

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

          <div className="nb-hint">💡 点击视频直接播放；点击文档可在线查看或下载</div>

          {error && <div className="nb-import-result">{error}</div>}

          {loading ? (
            <div className="nb-loading">加载中...</div>
          ) : files.length === 0 ? (
            <div className="nb-empty">该目录为空</div>
          ) : (
            <table className="nb-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th className="nb-col-size">大小</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.fsId} className={f.isDir === 1 ? 'nb-row-dir' : ''}>
                    <td className="nb-col-name">
                      {f.isDir === 1 ? (
                        <a className="nb-dir-link" onClick={() => load(f.path)} title={f.path}>
                          {extIcon(f)} {f.filename}
                        </a>
                      ) : (
                        <a className="nb-file-link" onClick={() => openFile(f)} title={`点击打开 ${f.filename}`}>
                          {extIcon(f)} {f.filename}
                        </a>
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

      {/* 视频播放弹窗 */}
      {viewer?.kind === 'video' && (
        <div className="nb-modal-overlay" onClick={closeViewer}>
          <div className="nb-modal nb-modal-video" onClick={(e) => e.stopPropagation()}>
            <div className="nb-modal-head">
              <b>🎬 {viewer.f.filename}</b>
              <button className="nb-btn" onClick={closeViewer}>✕ 关闭</button>
            </div>
            <video
              className="nb-video"
              src={streamUrl(viewer.f)}
              controls
              autoPlay
              preload="metadata"
            />
            <div className="nb-modal-foot">
              <span className="nb-size-tag">{fmtSize(viewer.f.size)}</span>
              <a className="nb-btn" href={fileUrl(viewer.f, 'attachment')}>⬇ 下载到本地</a>
            </div>
          </div>
        </div>
      )}

      {/* 图片查看弹窗 */}
      {viewer?.kind === 'image' && (
        <div className="nb-modal-overlay" onClick={closeViewer}>
          <div className="nb-modal nb-modal-image" onClick={(e) => e.stopPropagation()}>
            <div className="nb-modal-head">
              <b>🖼️ {viewer.f.filename}</b>
              <button className="nb-btn" onClick={closeViewer}>✕ 关闭</button>
            </div>
            <img className="nb-image" src={fileUrl(viewer.f, 'inline')} alt={viewer.f.filename} />
          </div>
        </div>
      )}

      {/* 文档操作弹窗：在线查看 / 下载 */}
      {viewer?.kind === 'doc' && (
        <div className="nb-modal-overlay" onClick={closeViewer}>
          <div className="nb-modal nb-modal-doc" onClick={(e) => e.stopPropagation()}>
            <div className="nb-modal-head">
              <b>📄 {viewer.f.filename}</b>
              <button className="nb-btn" onClick={closeViewer}>✕ 关闭</button>
            </div>
            <div className="nb-doc-body">
              <p>文件大小：{fmtSize(viewer.f.size)}</p>
              {extOf(viewer.f) === 'pdf' ? (
                <p className="nb-doc-tip">PDF 支持浏览器内在线查看，也可下载到本地。</p>
              ) : (
                <p className="nb-doc-tip">该格式不支持浏览器内预览，建议下载后用对应软件打开。</p>
              )}
              <div className="nb-doc-actions">
                {extOf(viewer.f) === 'pdf' && (
                  <button className="nb-btn nb-btn-primary" onClick={() => { setInlineDoc(viewer.f); setViewer(null); }}>
                    👁 在线查看
                  </button>
                )}
                <a className="nb-btn nb-btn-primary" href={fileUrl(viewer.f, 'attachment')}>
                  ⬇ 下载文件
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF 在线查看（iframe） */}
      {inlineDoc && (
        <div className="nb-modal-overlay" onClick={() => setInlineDoc(null)}>
          <div className="nb-modal nb-modal-pdf" onClick={(e) => e.stopPropagation()}>
            <div className="nb-modal-head">
              <b>👁 {inlineDoc.filename}</b>
              <button className="nb-btn" onClick={() => setInlineDoc(null)}>✕ 关闭</button>
            </div>
            <iframe className="nb-pdf-frame" src={fileUrl(inlineDoc, 'inline')} title={inlineDoc.filename} />
          </div>
        </div>
      )}
    </div>
  );
}
