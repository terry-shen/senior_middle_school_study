import { useEffect, useMemo, useRef } from 'react';
import type { AssetLite } from '../services/learning-api';
import { reportLearningEvent } from '../services/learning-api';
import { useModalDialog } from '../hooks/useModalDialog';
import './ResourceViewer.css';

const API_BASE = '/api';

const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'webm', 'm4v'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

interface ResourceViewerProps {
  asset: AssetLite | null;
  token: string;
  onClose: () => void;
  sectionId?: number | null;
}

export function viewerKind(asset: AssetLite): 'video' | 'image' | 'pdf' | 'download' {
  const ext = (asset.ext || asset.name.split('.').pop() || '').toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'download';
}

export default function ResourceViewer({ asset, token, onClose, sectionId = null }: ResourceViewerProps) {
  const kind = useMemo(() => (asset ? viewerKind(asset) : 'download'), [asset]);
  const modalRef = useModalDialog<HTMLDivElement>(!!asset, onClose);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastFlushRef = useRef(Date.now());
  const positionRef = useRef(0);
  const durationRef = useRef(0);

  // 资源停留埋点：记录本次打开该资源、页面可见的停留秒数（所有类型都记）
  useEffect(() => {
    if (!asset) return;
    let acc = 0;
    let last = Date.now();
    const flush = () => {
      const sec = Math.round(acc);
      acc = 0;
      if (sec <= 0) return;
      reportLearningEvent(token, {
        type: 'asset_dwell',
        assetId: asset.id,
        sectionId,
        durationSec: Math.min(sec, 7200),
        meta: { name: asset.name, kind: viewerKind(asset) },
      });
    };
    const tick = () => {
      const now = Date.now();
      const delta = Math.round((now - last) / 1000);
      last = now;
      if (delta > 0 && delta < 120 && document.visibilityState === 'visible') acc += Math.min(delta, 60);
    };
    const onVisibility = () => { tick(); if (document.visibilityState === 'hidden') flush(); };
    const id = window.setInterval(tick, 10000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      tick();
      flush();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [asset, token, sectionId]);

  // 视频播放埋点：只累计实际播放秒数（暂停/拖动不计）
  useEffect(() => {
    if (!asset || kind !== 'video') return;
    playedRef.current = 0;
    lastTimeRef.current = 0;
    lastFlushRef.current = Date.now();
    positionRef.current = 0;
    durationRef.current = 0;

    const flush = () => {
      const sec = Math.round(playedRef.current);
      if (sec <= 0) return;
      playedRef.current = 0;
      lastFlushRef.current = Date.now();
      reportLearningEvent(token, {
        type: 'video_progress',
        assetId: asset.id,
        sectionId,
        durationSec: Math.min(sec, 600),
        meta: { name: asset.name, position: Math.round(positionRef.current), duration: Math.round(durationRef.current) },
      });
    };

    const onTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      positionRef.current = video.currentTime || 0;
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
      if (video.paused) { lastTimeRef.current = video.currentTime || 0; return; }
      const t = video.currentTime || 0;
      const delta = t - lastTimeRef.current;
      if (delta > 0 && delta < 2) playedRef.current += delta;
      lastTimeRef.current = t;
      if (Date.now() - lastFlushRef.current >= 15000) flush();
    };

    const video = videoRef.current;
    video?.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      video?.removeEventListener('timeupdate', onTimeUpdate);
      flush();
    };
  }, [asset, token, sectionId, kind]);

  function reportDownload() {
    if (!asset) return;
    reportLearningEvent(token, { type: 'download', assetId: asset.id, sectionId, meta: { name: asset.name } });
  }

  useEffect(() => {
    if (!asset) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asset, onClose]);

  if (!asset) return null;

  const fsId = asset.fsId || '';
  const inlineUrl = `${API_BASE}/netdisk/file?fsId=${encodeURIComponent(fsId)}&mode=inline&token=${encodeURIComponent(token)}`;
  const attachUrl = `${API_BASE}/netdisk/file?fsId=${encodeURIComponent(fsId)}&mode=attachment&token=${encodeURIComponent(token)}`;
  const streamUrl = `${API_BASE}/netdisk/stream?fsId=${encodeURIComponent(fsId)}&token=${encodeURIComponent(token)}`;

  return (
    <div className="rv-overlay" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} className={`rv-modal rv-kind-${kind}`} onClick={(e) => e.stopPropagation()}>
        <div className="rv-head">
          <div className="rv-title">
            <span className="rv-kind">
              {kind === 'video' ? '🎬 视频' : kind === 'image' ? '🖼 图片' : kind === 'pdf' ? '📄 PDF' : '📎 文件'}
            </span>
            <span className="rv-name" title={asset.name}>{asset.name}</span>
          </div>
          <div className="rv-actions">
            {fsId && (
              <a className="rv-btn" href={attachUrl} download={asset.name} onClick={reportDownload}>
                ⬇ 下载
              </a>
            )}
            <button className="rv-btn rv-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="rv-body">
          {!fsId && <div className="rv-empty">该资源缺少网盘文件标识，无法打开。</div>}

          {fsId && kind === 'video' && (
            <video ref={videoRef} className="rv-video-el" controls autoPlay tabIndex={-1} src={streamUrl} onClick={() => modalRef.current?.focus({ preventScroll: true })} />
          )}

          {fsId && kind === 'image' && (
            <div className="rv-image-wrap">
              <img className="rv-image" src={inlineUrl} alt={asset.name} />
            </div>
          )}

          {fsId && kind === 'pdf' && (
            <iframe className="rv-pdf" src={inlineUrl} title={asset.name} />
          )}

          {fsId && kind === 'download' && (
            <div className="rv-download-panel">
              <div className="rv-download-icon">📄</div>
              <div className="rv-download-title">该格式（.{(asset.ext || '?').toLowerCase()}）无法在浏览器内直接预览</div>
              <a className="rv-btn rv-btn-primary" href={attachUrl} download={asset.name} onClick={reportDownload}>
                ⬇ 下载文件
              </a>
            </div>
          )}
        </div>

        <div className="rv-foot">
          <span>{(asset.series || '').trim()}</span>
          <span>{asset.year ? `${asset.year} 年` : ''}</span>
          <span>{asset.region || ''}</span>
        </div>
      </div>
    </div>
  );
}
