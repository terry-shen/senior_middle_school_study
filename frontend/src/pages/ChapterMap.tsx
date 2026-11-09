import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubject } from '../contexts/SubjectContext';
import {
  getProgress,
  getVideoSeries,
  type AssetLite,
  type LearningProgress,
  type VideoSeries,
  type VideoSeriesItem,
} from '../services/learning-api';
import ResourceViewer from '../components/ResourceViewer';
import './ChapterMap.css';

function cleanVideoName(name: string): string {
  return name.replace(/\.(mp4|mkv|mov|avi|flv|ts|webm|m4v|wmv)$/i, '').replace(/\s*\d+\]$/, '').trim();
}

function formatSize(size: string): string {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${Math.round(mb)}M`;
}

export default function ChapterMap() {
  const { token } = useAuth();
  const { selectedSubject } = useSubject();
  const navigate = useNavigate();
  const [videoSeries, setVideoSeries] = useState<VideoSeries[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});
  const [openTags, setOpenTags] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<AssetLite | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [videoRes, progRes] = await Promise.all([getVideoSeries(token), getProgress(token)]);
      setVideoSeries(videoRes.series || []);
      setVideoTotal(videoRes.total || 0);
      setProgress(progRes.progress || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!videoSeries.length) return;
    const first = videoSeries[0];
    setOpenSeries((prev) => (Object.keys(prev).length ? prev : { [first.series]: true }));
    const g = first.groups[0];
    if (g) setOpenTags((prev) => (Object.keys(prev).length ? prev : { [`${first.series}|${g.tag}`]: true }));
  }, [videoSeries]);

  const toggleSeries = (s: string) => setOpenSeries((p) => ({ ...p, [s]: !p[s] }));
  const toggleTag = (key: string) => setOpenTags((p) => ({ ...p, [key]: !p[key] }));

  const openVideo = (v: VideoSeriesItem) => {
    setViewing({
      id: v.id,
      fsId: v.fsId,
      name: v.name,
      ext: 'mp4',
      size: v.size,
      assetKind: 'video',
      audience: 'both',
      year: null,
      region: null,
      series: null,
      isPinned: false,
      status: 'active',
      mapConfirmed: true,
    });
  };

  return (
    <div className="chapter-map">
      <div className="cmap-head">
        <div>
          <h1>📖 章节学习</h1>
          <p className="cmap-sub">
            {selectedSubject ? `${selectedSubject.icon || ''} ${selectedSubject.name}` : '全部学科'}
            <span className="cmap-dot">·</span>
            以视频课程为主线，教材章节与讲义/练习/试卷并入对应课程章节
          </p>
        </div>
        <button className="cmap-refresh" onClick={load} disabled={loading}>刷新</button>
      </div>

      {progress && (
        <div className="cmap-continue">
          <div className="cmap-continue-text">
            <span className="cmap-continue-label">继续学习</span>
            <span className="cmap-continue-path">
              {progress.textbookName} / {progress.chapterTitle} / {progress.sectionTitle}
            </span>
            {progress.assetName && <span className="cmap-continue-asset">上次：{progress.assetName}</span>}
          </div>
          <button className="cmap-continue-btn" onClick={() => navigate(`/learning/section/${progress.sectionId}`)}>
            继续 →
          </button>
        </div>
      )}

      {loading && <p className="cmap-loading">加载中...</p>}
      {!loading && error && <p className="cmap-error">{error}</p>}
      {!loading && !error && videoSeries.length === 0 && (
        <p className="cmap-empty">当前学科暂无课程资源。</p>
      )}

      {!loading && !error && videoSeries.length > 0 && (
        <section className="cmap-videos">
          <div className="cmap-videos-head">
            <h2>🎬 视频主线课程</h2>
            <span className="cmap-videos-meta">共 {videoTotal} 个视频 · 按课程顺序跟随学习</span>
          </div>
          {videoSeries.map((s) => {
            const sOpen = !!openSeries[s.series];
            return (
              <div key={s.series} className="cmap-vseries">
                <button className="cmap-vseries-head" onClick={() => toggleSeries(s.series)}>
                  <span className="cmap-caret">{sOpen ? '▾' : '▸'}</span>
                  <span className="cmap-vseries-name">{s.series}</span>
                  <span className="cmap-vseries-meta">{s.groups.length} 个课程章节 · {s.total} 个视频</span>
                </button>
                {sOpen && (
                  <div className="cmap-vgroups">
                    {s.groups.map((g) => {
                      const key = `${s.series}|${g.tag}`;
                      const gOpen = !!openTags[key];
                      const sectionCount = g.sections.length;
                      return (
                        <div key={key} className="cmap-vgroup">
                          <button className="cmap-vgroup-head" onClick={() => toggleTag(key)}>
                            <span className="cmap-caret">{gOpen ? '▾' : '▸'}</span>
                            <span className="cmap-vgroup-tag">{g.tag}</span>
                            <span className="cmap-vgroup-count">{g.videos.length} 视频</span>
                            {sectionCount > 0 && <span className="cmap-vgroup-count">{sectionCount} 节教材</span>}
                          </button>
                          {gOpen && (
                            <>
                              {g.videos.length > 0 && (
                                <ul className="cmap-videos-list">
                                  {g.videos.map((v) => (
                                    <li key={v.id}>
                                      <button className="cmap-video-item" onClick={() => openVideo(v)}>
                                        <span className="cmap-video-play">▶</span>
                                        <span className="cmap-video-name">{cleanVideoName(v.name)}</span>
                                        {v.size && <span className="cmap-video-size">{formatSize(v.size)}</span>}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {sectionCount > 0 && (
                                <ul className="cmap-sections">
                                  <li className="cmap-sections-label">📚 关联教材小节</li>
                                  {g.sections.map((sec) => (
                                    <li key={sec.id}>
                                      <button className="cmap-section-link" onClick={() => navigate(`/learning/section/${sec.id}`)}>
                                        <span className="cmap-section-title">{sec.title}</span>
                                        <span className="cmap-badges">
                                          <span className="cmap-badge">资源 {sec.resourceCount}</span>
                                          {sec.paperCount > 0 && <span className="cmap-badge cmap-badge-paper">试卷 {sec.paperCount}</span>}
                                          {sec.weakCount > 0 && <span className="cmap-badge cmap-badge-weak">薄弱 {sec.weakCount}</span>}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <ResourceViewer asset={viewing} token={token || ''} onClose={() => setViewing(null)} />
    </div>
  );
}
