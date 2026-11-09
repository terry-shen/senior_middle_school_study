import { useEffect, useMemo } from 'react';
import type { AssetLite } from '../services/learning-api';
import './ResourceViewer.css';

const API_BASE = 'http://localhost:3000/api';

const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'webm', 'm4v'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

interface ResourceViewerProps {
  asset: AssetLite | null;
  token: string;
  onClose: () => void;
}

export function viewerKind(asset: AssetLite): 'video' | 'image' | 'pdf' | 'download' {
  const ext = (asset.ext || asset.name.split('.').pop() || '').toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'download';
}

export default function ResourceViewer({ asset, token, onClose }: ResourceViewerProps) {
  const kind = useMemo(() => (asset ? viewerKind(asset) : 'download'), [asset]);

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
      <div className={`rv-modal rv-kind-${kind}`} onClick={(e) => e.stopPropagation()}>
        <div className="rv-head">
          <div className="rv-title">
            <span className="rv-kind">
              {kind === 'video' ? '🎬 视频' : kind === 'image' ? '🖼 图片' : kind === 'pdf' ? '📄 PDF' : '📎 文件'}
            </span>
            <span className="rv-name" title={asset.name}>{asset.name}</span>
          </div>
          <div className="rv-actions">
            {fsId && (
              <a className="rv-btn" href={attachUrl} download={asset.name}>
                ⬇ 下载
              </a>
            )}
            <button className="rv-btn rv-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="rv-body">
          {!fsId && <div className="rv-empty">该资源缺少网盘文件标识，无法打开。</div>}

          {fsId && kind === 'video' && (
            <video className="rv-video-el" controls autoPlay src={streamUrl} />
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
              <a className="rv-btn rv-btn-primary" href={attachUrl} download={asset.name}>
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
