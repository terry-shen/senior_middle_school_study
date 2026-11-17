import { useState, useEffect, useCallback, useRef } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { listNetdiskFiles, getNetdiskPublicStatus } from '../services/netdisk-api';
import type { NetdiskFile } from '../services/netdisk-api';
import { reportLearningEvent } from '../services/learning-api';
import { getCurrentSectionId } from '../services/study-context';
import './NetdiskBrowser.css';

const API_BASE = '/api';

interface Props {
  token: string;
  /** 管理员绑定页浏览全学科，不按当前学科过滤 */
  allSubjects?: boolean;
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

export default function NetdiskBrowser({ token, allSubjects }: Props) {
  const [bound, setBound] = useState<boolean | null>(null);
  const [dir, setDir] = useState('/apps/高中学习系统');
  const [files, setFiles] = useState<NetdiskFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [inlineDoc, setInlineDoc] = useState<NetdiskFile | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dwellRef = useRef({ acc: 0, last: Date.now(), name: '' });

  // 停留埋点：记录打开某个文件后页面可见的停留秒数（含视频/图片/文档）
  useEffect(() => {
    if (!viewer || !token) return;
    const name = viewer.f.filename;
    const fsId = viewer.f.fsId;
    dwellRef.current = { acc: 0, last: Date.now(), name };
    const flush = () => {
      const sec = Math.round(dwellRef.current.acc);
      dwellRef.current.acc = 0;
      if (sec <= 0) return;
      reportLearningEvent(token, {
        type: 'asset_dwell',
        sectionId: getCurrentSectionId(),
        durationSec: Math.min(sec, 7200),
        meta: { name, fsId, source: 'browser' },
      });
    };
    const tick = () => {
      const now = Date.now();
      const delta = Math.round((now - dwellRef.current.last) / 1000);
      dwellRef.current.last = now;
      if (delta > 0 && delta < 120 && document.visibilityState === 'visible') dwellRef.current.acc += Math.min(delta, 60);
    };
    const id = window.setInterval(tick, 10000);
    return () => {
      tick();
      flush();
      window.clearInterval(id);
    };
  }, [viewer, token]);

  // 视频播放埋点：只累计实际播放秒数
  useEffect(() => {
    if (!viewer || viewer.kind !== 'video' || !token) return;
    const name = viewer.f.filename;
    const fsId = viewer.f.fsId;
    let played = 0;
    let lastT = 0;
    let lastFlush = Date.now();
    let pos = 0;
    let dur = 0;
    const flush = () => {
      const sec = Math.round(played);
      if (sec <= 0) return;
      played = 0;
      lastFlush = Date.now();
      reportLearningEvent(token, {
        type: 'video_progress',
        sectionId: getCurrentSectionId(),
        durationSec: Math.min(sec, 600),
        meta: { name, fsId, source: 'browser', position: Math.round(pos), duration: Math.round(dur) },
      });
    };
    const onTimeUpdate = () => {
      const v = videoRef.current;
      if (!v) return;
      pos = v.currentTime || 0;
      dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (v.paused) { lastT = v.currentTime || 0; return; }
      const delta = pos - lastT;
      if (delta > 0 && delta < 2) played += delta;
      lastT = pos;
      if (Date.now() - lastFlush >= 15000) flush();
    };
    const v = videoRef.current;
    v?.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      v?.removeEventListener('timeupdate', onTimeUpdate);
      flush();
    };
  }, [viewer, token]);

  const reportDownload = (f: NetdiskFile) => {
    if (!token) return;
    reportLearningEvent(token, {
      type: 'download',
      sectionId: getCurrentSectionId(),
      meta: { name: f.filename, fsId: f.fsId, source: 'browser' },
    });
  };

  useEffect(() => {
    getNetdiskPublicStatus(token).then((s) => setBound(!!s.bound)).catch(() => setBound(false));
  }, [token]);

  const load = useCallback(async (d: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const r = await listNetdiskFiles(token, d, { allSubjects });
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
    if (token) {
      reportLearningEvent(token, {
        type: 'asset_open',
        sectionId: getCurrentSectionId(),
        meta: { name: f.filename, fsId: f.fsId, source: 'browser' },
      });
    }
    if (VIDEO_EXTS.includes(ext)) setViewer({ kind: 'video', f });
    else if (IMG_EXTS.includes(ext)) setViewer({ kind: 'image', f });
    else setViewer({ kind: 'doc', f });
  };

  const closeViewer = () => setViewer(null);
  const modalRef = useModalDialog<HTMLDivElement>(viewer !== null, closeViewer);

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
          <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} className="nb-modal nb-modal-video" onClick={(e) => e.stopPropagation()}>
            <div className="nb-modal-head">
              <b>🎬 {viewer.f.filename}</b>
              <button className="nb-btn" onClick={closeViewer}>✕ 关闭</button>
            </div>
            <video
              ref={videoRef}
              className="nb-video"
              src={streamUrl(viewer.f)}
              controls
              autoPlay
              preload="metadata"
              tabIndex={-1}
              onClick={() => modalRef.current?.focus({ preventScroll: true })}
            />
            <div className="nb-modal-foot">
              <span className="nb-size-tag">{fmtSize(viewer.f.size)}</span>
              <a className="nb-btn" href={fileUrl(viewer.f, 'attachment')} onClick={() => reportDownload(viewer.f)}>⬇ 下载到本地</a>
            </div>
          </div>
        </div>
      )}

      {/* 图片查看弹窗 */}
      {viewer?.kind === 'image' && (
        <div className="nb-modal-overlay" onClick={closeViewer}>
          <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} className="nb-modal nb-modal-image" onClick={(e) => e.stopPropagation()}>
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
          <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} className="nb-modal nb-modal-doc" onClick={(e) => e.stopPropagation()}>
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
                <a className="nb-btn nb-btn-primary" href={fileUrl(viewer.f, 'attachment')} onClick={() => reportDownload(viewer.f)}>
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
