import { useEffect, useMemo, useRef } from 'react';
import type { AssetLite } from '../services/learning-api';
import { reportLearningEvent } from '../services/learning-api';
import { useModalDialog } from '../hooks/useModalDialog';
import { useActivity } from '../contexts/ActivityContext';
import { useActivityLog } from '../contexts/ActivityLogContext';
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

/** 打开资源时开始计时，关闭时上报一条 asset_session */
export default function ResourceViewer({ asset, token, onClose, sectionId = null }: ResourceViewerProps) {
  const kind = useMemo(() => (asset ? viewerKind(asset) : 'download'), [asset]);
  const modalRef = useModalDialog<HTMLDivElement>(!!asset, onClose);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTimeRef = useRef(0);
  const { markActive, setVideoPlaying } = useActivity();
  const { logActivity } = useActivityLog();

  useEffect(() => {
    if (!asset) return;
    const session = { dwell: 0, play: 0, position: 0, duration: 0 };
    let last = Date.now();
    lastTimeRef.current = 0;

    const tick = () => {
      const now = Date.now();
      const delta = (now - last) / 1000;
      last = now;
      if (delta > 0 && delta < 120 && document.visibilityState === 'visible') {
        session.dwell += Math.min(delta, 60);
      }
    };

    const onTimeUpdate = () => {
      const v = videoRef.current;
      if (!v) return;
      const t = v.currentTime || 0;
      session.position = t;
      if (Number.isFinite(v.duration)) session.duration = v.duration;
      if (!v.paused) {
        const d = t - lastTimeRef.current;
        if (d > 0 && d < 2) session.play += d;
      }
      lastTimeRef.current = t;
      if (!v.paused) markActive();
    };

    const onPlay = () => {
      setVideoPlaying(true);
      markActive();
      const v = videoRef.current;
      logActivity({
        type: 'video_play',
        target: `asset:${asset.id}`,
        label: asset.name,
        sectionId,
        assetId: asset.id,
        meta: { position: Math.round(v?.currentTime || 0) },
      });
    };
    const onPause = () => {
      setVideoPlaying(false);
      const v = videoRef.current;
      logActivity({
        type: 'video_pause',
        target: `asset:${asset.id}`,
        label: asset.name,
        sectionId,
        assetId: asset.id,
        meta: { position: Math.round(v?.currentTime || 0) },
      });
    };
    const onEnded = () => {
      setVideoPlaying(false);
      logActivity({
        type: 'video_ended',
        target: `asset:${asset.id}`,
        label: asset.name,
        sectionId,
        assetId: asset.id,
      });
    };
    const onSeeked = () => {
      const v = videoRef.current;
      logActivity({
        type: 'video_seek',
        target: `asset:${asset.id}`,
        label: asset.name,
        sectionId,
        assetId: asset.id,
        meta: { position: Math.round(v?.currentTime || 0) },
      });
    };

    const id = window.setInterval(tick, 5000);
    const video = videoRef.current;
    video?.addEventListener('timeupdate', onTimeUpdate);
    video?.addEventListener('play', onPlay);
    video?.addEventListener('pause', onPause);
    video?.addEventListener('ended', onEnded);
    video?.addEventListener('seeked', onSeeked);
    if (video) setVideoPlaying(!video.paused && !video.ended);

    const flush = () => {
      tick();
      const dwellSec = Math.min(7200, Math.round(session.dwell));
      const playSec = Math.round(session.play);
      if (dwellSec <= 0 && playSec <= 0) return;
      reportLearningEvent(token, {
        type: 'asset_session',
        assetId: asset.id,
        sectionId,
        durationSec: dwellSec,
        meta: {
          name: asset.name,
          kind: viewerKind(asset),
          playSec,
          position: Math.round(session.position),
          duration: Math.round(session.duration),
        },
      });
      session.dwell = 0;
      session.play = 0;
    };

    return () => {
      flush();
      window.clearInterval(id);
      video?.removeEventListener('timeupdate', onTimeUpdate);
      video?.removeEventListener('play', onPlay);
      video?.removeEventListener('pause', onPause);
      video?.removeEventListener('ended', onEnded);
      video?.removeEventListener('seeked', onSeeked);
      setVideoPlaying(false);
    };
  }, [asset, token, sectionId, markActive, setVideoPlaying, logActivity]);

  function reportDownload() {
    if (!asset) return;
    logActivity({
      type: 'download',
      target: `asset:${asset.id}`,
      label: asset.name,
      sectionId,
      assetId: asset.id,
    });
    reportLearningEvent(token, { type: 'download', assetId: asset.id, sectionId, meta: { name: asset.name } });
  }

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
              <a className="rv-btn" href={attachUrl} download={asset.name} data-track-skip onClick={reportDownload}>
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
              <a className="rv-btn rv-btn-primary" href={attachUrl} download={asset.name} data-track-skip onClick={reportDownload}>
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
