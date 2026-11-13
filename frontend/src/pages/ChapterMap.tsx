import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getLearningSubjects,
  getProgress,
  getVideoSeries,
  type AssetLite,
  type LearningProgress,
  type LearningSubject,
  type VideoSeries,
  type VideoSeriesItem,
} from '../services/learning-api';
import { setSelectedSubjectId } from '../services/subjects-api';
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
  const { code } = useParams<{ code: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [subject, setSubject] = useState<LearningSubject | null>(null);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [videoSeries, setVideoSeries] = useState<VideoSeries[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});
  const [openTags, setOpenTags] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<AssetLite | null>(null);

  // 1) 学科列表 + 当前学科（由路由 /learning/:code 决定）
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getLearningSubjects(token)
      .then((res) => {
        if (cancelled) return;
        const list = res.data ?? [];
        setSubjects(list);
        setSubjectsLoaded(true);
        const found = list.find((s) => s.code === code) ?? null;
        setSubject(found);
        if (found) {
          setSelectedSubjectId(found.id);
          localStorage.setItem('learningSubjectCode', found.code);
          localStorage.setItem('learningSubjectId', String(found.id));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载学科失败');
      });
    return () => {
      cancelled = true;
    };
  }, [token, code]);

  // 2) 该学科的视频主线 + 学习进度
  const loadContent = useCallback(async () => {
    if (!token || !subject) return;
    if (subject.sectionCount === 0 && (subject.videoCount ?? 0) === 0) {
      setVideoSeries([]);
      setVideoTotal(0);
      setProgress(null);
      setLoading(false);
      return;
    }
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
      setOpenSeries({});
      setOpenTags({});
    }
  }, [token, subject]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

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

  const showProgress = !!progress && !!subject && (!progress.subjectId || progress.subjectId === subject.id);

  if (subjectsLoaded && !subject) {
    return (
      <div className="chapter-map">
        <div className="cmap-empty-box">
          <h2>学科不存在</h2>
          <p>请从左侧导航选择一个学科。</p>
          {subjects.length > 0 && (
            <button className="cmap-btn" onClick={() => navigate(`/learning/${subjects[0].code}`)}>
              前往「{subjects[0].name}」
            </button>
          )}
        </div>
      </div>
    );
  }

  if (subject && subject.sectionCount === 0 && (subject.videoCount ?? 0) === 0) {
    return (
      <div className="chapter-map">
        <div className="cmap-head">
          <div>
            <h1>
              {subject.icon || '📘'} {subject.name}
            </h1>
            <p className="cmap-sub">该学科内容正在建设中。</p>
          </div>
        </div>
        <div className="cmap-empty-box">
          <div className="cmap-empty-icon">🚧</div>
          <h2>待建设</h2>
          <p>「{subject.name}」的教材目录与视频课程尚未录入，接入后即可在这里按章节学习。</p>
          <button className="cmap-btn" onClick={() => navigate('/')}>
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chapter-map">
      <div className="cmap-head">
        <div>
          <h1>
            {subject?.icon || '📖'} {subject?.name || '章节学习'}
          </h1>
          <p className="cmap-sub">按视频课程主线学习，教材小节内含精选视频、讲义与练习。</p>
        </div>
        <button className="cmap-refresh" onClick={loadContent} disabled={loading}>刷新</button>
      </div>

      {showProgress && progress && (
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
        <p className="cmap-empty">该学科暂无视频课程，请先到「资源映射」完成资源整理。</p>
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
