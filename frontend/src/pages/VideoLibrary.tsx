import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listResources, recordPlay } from '../services/video-library-api';
import type { VideoResource } from '../services/video-library-api';
import NetdiskBrowser from '../components/NetdiskBrowser';
import './VideoLibrary.css';

export default function VideoLibrary() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<VideoResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'all' | 'video' | 'document'>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<VideoResource | null>(null);

  const load = useCallback(async (p = page, t = type, k = keyword) => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await listResources(token, {
        type: t === 'all' ? undefined : t,
        keyword: k || undefined,
        page: p,
        limit: 12,
      });
      setItems(r.data || []);
      setTotalPages(r.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [token, page, type, keyword]);

  useEffect(() => { load(1); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = async (r: VideoResource) => {
    if (!token) return;
    recordPlay(token, r.id).catch(() => {});
    window.open(r.shareUrl!, '_blank');
  };

  const handleView = async (r: VideoResource) => {
    setSelected(r);
    if (r.resourceType === 'document' && !r.shareUrl) {
      // 本地文件：直接打开 fileUrl
      return;
    }
    if (r.resourceType === 'document' && r.shareUrl) {
      recordPlay(token!, r.id).catch(() => {});
      window.open(r.shareUrl, '_blank');
    }
  };

  const formatSize = (s?: number | string | null) => {
    const n = typeof s === 'string' ? parseInt(s) : s;
    if (!n) return '';
    if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024).toFixed(0) + ' KB';
  };

  return (
    <div className="video-library">
      <h1>📺 学习资源</h1>

      {token && (
        <NetdiskBrowser
          token={token}
          canImport={user?.role === 'admin'}
          onImported={() => { setPage(1); load(1); }}
        />
      )}

      <div className="vl-filter-bar">
        <div className="vl-type-tabs">
          {(['all', 'video', 'document'] as const).map((t) => (
            <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
              {t === 'all' ? '全部' : t === 'video' ? '🎬 视频' : '📄 教辅'}
            </button>
          ))}
        </div>
        <div className="vl-search">
          <input
            type="text"
            placeholder="搜索标题/章节..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, type, keyword); } }}
          />
          <button onClick={() => { setPage(1); load(1, type, keyword); }}>搜索</button>
        </div>
      </div>

      {loading ? (
        <p className="vl-loading">加载中...</p>
      ) : items.length === 0 ? (
        <p className="vl-empty">暂无资源</p>
      ) : (
        <div className="vl-grid">
          {items.map((r) => (
            <div key={r.id} className={`vl-card ${r.resourceType}`} onClick={() => handleView(r)}>
              <div className="vl-card-cover">
                {r.coverUrl ? (
                  <img src={r.coverUrl} alt={r.title} />
                ) : (
                  <div className="vl-cover-placeholder">{r.resourceType === 'video' ? '🎬' : '📄'}</div>
                )}
                {r.resourceType === 'video' && <span className="vl-play-overlay">▶</span>}
              </div>
              <div className="vl-card-body">
                <h3>{r.title}</h3>
                <div className="vl-card-meta">
                  {r.subject && <span className="vl-tag">{r.subject.icon} {r.subject.name}</span>}
                  {r.grade && <span className="vl-tag">{r.grade}</span>}
                  {r.chapter && <span className="vl-tag">{r.chapter}</span>}
                </div>
                <div className="vl-card-footer">
                  <span className="vl-count">{r.resourceType === 'video' ? `▶ ${r.playCount}` : `👁 ${r.viewCount}`}</span>
                  {r.duration && <span className="vl-duration">{Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}</span>}
                  {r.fileSize && <span className="vl-size">{formatSize(r.fileSize)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="vl-pagination">
          <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p); }}>下一页</button>
        </div>
      )}

      {selected && selected.resourceType === 'video' && (
        <div className="vl-detail-overlay" onClick={() => setSelected(null)}>
          <div className="vl-detail" onClick={(e) => e.stopPropagation()}>
            <button className="vl-close" onClick={() => setSelected(null)}>✕</button>
            <h2>{selected.title}</h2>
            {selected.description && <p className="vl-desc">{selected.description}</p>}
            <div className="vl-detail-meta">
              {selected.subject && <span>{selected.subject.icon} {selected.subject.name}</span>}
              {selected.grade && <span>{selected.grade}</span>}
              {selected.chapter && <span>{selected.chapter}</span>}
              {selected.duration && <span>时长 {Math.floor(selected.duration / 60)} 分钟</span>}
              <span>播放 {selected.playCount} 次</span>
            </div>
            {selected.coverUrl && <img className="vl-detail-cover" src={selected.coverUrl} alt="" />}
            {selected.shareUrl ? (
              <button className="vl-btn-play" onClick={() => handlePlay(selected)}>
                ▶ 打开网盘播放（新窗口）
              </button>
            ) : (
              <p className="vl-no-share">该资源暂无分享链接，请联系管理员</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
