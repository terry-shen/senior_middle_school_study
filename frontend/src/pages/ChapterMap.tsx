import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useActivityLog } from '../contexts/ActivityLogContext';
import {
  getLearningSubjects,
  getProgress,
  getVideoSeries,
  getResourceLibrarySummary,
  getResourceLibraryAssets,
  type AssetLite,
  type LearningProgress,
  type LearningSubject,
  type ResourceLibraryAsset,
  type ResourceLibrarySummary,
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
  const { logActivity } = useActivityLog();

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
  const [category, setCategory] = useState<'video' | 'library'>('video');

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

  // 记录进入学科（直接访问或导航进入都算一次学科打开）
  useEffect(() => {
    if (!subject) return;
    logActivity({
      type: 'subject_open',
      target: `/learning/${subject.code}`,
      label: subject.name,
      subjectId: subject.id,
    });
  }, [subject, logActivity]);

  // 2) 该学科的视频主线 + 学习进度
  const loadContent = useCallback(async () => {
    if (!token || !subject) return;
    if (subject.sectionCount === 0 && (subject.videoCount ?? 0) === 0 && (subject.resourceCount ?? 0) === 0) {
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
    if (loading || !subject) return;
    setCategory(videoTotal === 0 && (subject.resourceCount ?? 0) > 0 ? 'library' : 'video');
  }, [subject?.id, loading]);

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
    logActivity({
      type: 'asset_open',
      target: `video:${v.id}`,
      label: cleanVideoName(v.name),
      assetId: v.id,
    });
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

  const openLibraryAsset = (asset: AssetLite) => {
    logActivity({
      type: 'asset_open',
      target: `library:${asset.id}`,
      label: asset.name,
      assetId: asset.id,
      subjectId: subject?.id ?? null,
    });
    setViewing(asset);
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

  if (subject && subject.sectionCount === 0 && (subject.videoCount ?? 0) === 0 && (subject.resourceCount ?? 0) === 0) {
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
          <p className="cmap-sub">视频主线与教辅资源并行，教材小节内含精选视频、讲义与练习。</p>
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
          <button
            className="cmap-continue-btn"
            data-track="nav_click"
            data-track-target={`/learning/section/${progress.sectionId}`}
            data-track-label="继续学习"
            data-track-section-id={progress.sectionId}
            onClick={() => navigate(`/learning/section/${progress.sectionId}`)}
          >
            继续 →
          </button>
        </div>
      )}

      <div className="cmap-cat-tabs">
        <button
          className={`cmap-cat-tab ${category === 'video' ? 'active' : ''}`}
          data-track="filter"
          data-track-target="category:video"
          data-track-label="视频主线课程"
          onClick={() => setCategory('video')}
        >
          🎬 视频主线课程 <span className="cmap-cat-count">{videoTotal}</span>
        </button>
        {(subject?.resourceCount ?? 0) > 0 && (
          <button
            className={`cmap-cat-tab ${category === 'library' ? 'active' : ''}`}
            data-track="filter"
            data-track-target="category:library"
            data-track-label="教辅资源"
            onClick={() => setCategory('library')}
          >
            📚 教辅资源 <span className="cmap-cat-count">{subject?.resourceCount}</span>
          </button>
        )}
      </div>

      {loading && <p className="cmap-loading">加载中...</p>}
      {!loading && error && <p className="cmap-error">{error}</p>}
      {!loading && !error && category === 'video' && videoSeries.length === 0 && (
        <p className="cmap-empty">该学科暂无视频课程，请先到「资源映射」完成资源整理。</p>
      )}

      {!loading && !error && category === 'video' && videoSeries.length > 0 && (
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
                                      <button className="cmap-video-item" data-track-skip onClick={() => openVideo(v)}>
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
                                      <button className="cmap-section-link" data-track-skip onClick={() => navigate(`/learning/section/${sec.id}`)}>
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

      {!loading && !error && category === 'library' && subject && (
        <ResourceLibrary subject={subject} token={token || ''} onOpen={openLibraryAsset} />
      )}

      <ResourceViewer asset={viewing} token={token || ''} onClose={() => setViewing(null)} />
    </div>
  );
}

function ResourceLibrary({
  subject,
  token,
  onOpen,
}: {
  subject: LearningSubject;
  token: string;
  onOpen: (asset: AssetLite) => void;
}) {
  const [summary, setSummary] = useState<ResourceLibrarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('');
  const [year, setYear] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});
  const [openBook, setOpenBook] = useState<Record<string, boolean>>({});
  const { logActivity } = useActivityLog();
  const [files, setFiles] = useState<
    Record<string, { items: ResourceLibraryAsset[]; page: number; total: number; loading: boolean }>
  >({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getResourceLibrarySummary(token, {
      subjectId: subject.id,
      kind: kind || undefined,
      year: year ? Number(year) : undefined,
      q: q || undefined,
    })
      .then((r) => {
        if (!alive) return;
        setSummary(r);
        setOpenSeries({});
        setOpenBook({});
        setFiles({});
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '加载教辅资源失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, subject.id, kind, year, q]);

  const loadFiles = async (series: string, book: string, page = 1, append = false) => {
    const key = `${series}|${book}`;
    setFiles((prev) => ({
      ...prev,
      [key]: { items: append ? prev[key]?.items ?? [] : [], page, total: prev[key]?.total ?? 0, loading: true },
    }));
    try {
      const r = await getResourceLibraryAssets(token, {
        subjectId: subject.id,
        kind: kind || undefined,
        year: year ? Number(year) : undefined,
        q: q || undefined,
        series,
        book,
        page,
        limit: 30,
      });
      setFiles((prev) => ({
        ...prev,
        [key]: {
          items: append ? [...(prev[key]?.items ?? []), ...r.data] : r.data,
          page,
          total: r.pagination.total,
          loading: false,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载文件失败');
      setFiles((prev) => ({
        ...prev,
        [key]: { items: prev[key]?.items ?? [], page, total: prev[key]?.total ?? 0, loading: false },
      }));
    }
  };

  const toggleSeries = (series: string) => setOpenSeries((p) => ({ ...p, [series]: !p[series] }));
  const toggleBook = (series: string, book: string) => {
    const key = `${series}|${book}`;
    const next = !openBook[key];
    setOpenBook((p) => ({ ...p, [key]: next }));
    if (next && !files[key]) loadFiles(series, book, 1, false);
  };

  const runSearch = () => {
    const text = qInput.trim();
    setQ(text);
    logActivity({
      type: 'search',
      target: 'library-search',
      label: '搜索教辅资源',
      subjectId: subject.id,
      meta: { queryLength: text.length },
    });
  };

  const iconOf = (a: ResourceLibraryAsset) => {
    const ext = (a.ext || a.name.split('.').pop() || '').toLowerCase();
    if (['mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'webm', 'm4v'].includes(ext)) return '🎬';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return '🖼️';
    if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return '📄';
    if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return '🎧';
    return '📎';
  };

  return (
    <section className="cmap-lib">
      <div className="cmap-lib-head">
        <h2>📚 教辅资源</h2>
        <span className="cmap-lib-meta">
          教辅资源线 · 学生可见 · {summary?.total ?? 0} 条
        </span>
      </div>
      <div className="cmap-lib-filters">
        <select
          value={kind}
          data-track-skip
          onChange={(e) => {
            setKind(e.target.value);
            logActivity({
              type: 'filter',
              target: 'library-kind',
              label: '教辅类型',
              subjectId: subject.id,
              meta: { value: e.target.value || 'all' },
            });
          }}
        >
          <option value="">全部类型</option>
          {summary?.byKind.filter((k) => k.count > 0).map((k) => (
            <option key={k.key} value={k.key}>{k.label}（{k.count}）</option>
          ))}
        </select>
        <select
          value={year}
          data-track-skip
          onChange={(e) => {
            setYear(e.target.value);
            logActivity({
              type: 'filter',
              target: 'library-year',
              label: '教辅年份',
              subjectId: subject.id,
              meta: { value: e.target.value || 'all' },
            });
          }}
        >
          <option value="">全部年份</option>
          {summary?.byYear.filter((y) => y.year != null).map((y) => (
            <option key={String(y.year)} value={String(y.year)}>{y.year}（{y.count}）</option>
          ))}
        </select>
        <input
          value={qInput}
          placeholder="搜索书名 / 系列 / 文件名"
          data-track-skip
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
        />
        <button className="cmap-lib-search" data-track-skip onClick={runSearch}>搜索</button>
        {q && <button className="cmap-lib-clear" data-track="filter" data-track-target="library-clear" data-track-label="清除教辅搜索" onClick={() => { setQ(''); setQInput(''); }}>清除</button>}
      </div>
      {loading && <p className="cmap-loading">加载教辅资源...</p>}
      {!loading && error && <p className="cmap-error">{error}</p>}
      {!loading && !error && summary && summary.total === 0 && (
        <p className="cmap-empty">当前筛选条件下没有教辅资源。</p>
      )}
      {!loading && !error && summary && summary.total > 0 && (
        <div className="cmap-lib-groups">
          {summary.groups.map((g) => (
            <div key={g.series} className="cmap-lib-series">
              <button className="cmap-lib-series-head" onClick={() => toggleSeries(g.series)}>
                <span className="cmap-caret">{openSeries[g.series] ? '▾' : '▸'}</span>
                <span className="cmap-lib-series-name">{g.series}</span>
                <span className="cmap-lib-series-count">{g.count}</span>
              </button>
              {openSeries[g.series] && (
                <div className="cmap-lib-books">
                  {g.books.map((b) => {
                    const key = `${g.series}|${b.book}`;
                    const open = !!openBook[key];
                    const f = files[key];
                    return (
                      <div key={key} className="cmap-lib-book">
                        <button className="cmap-lib-book-head" onClick={() => toggleBook(g.series, b.book)}>
                          <span className="cmap-caret">{open ? '▾' : '▸'}</span>
                          <span className="cmap-lib-book-name" title={b.book}>{b.book}</span>
                          <span className="cmap-lib-book-count">{b.count}</span>
                        </button>
                        {open && (
                          <div className="cmap-lib-files">
                            {f?.loading && f.items.length === 0 && <p className="cmap-lib-hint">加载中...</p>}
                            {f?.items.map((a) => (
                              <button key={a.id} className="cmap-lib-file" data-track-skip onClick={() => onOpen(a)} title={a.dir}>
                                <span className="cmap-lib-file-icon">{iconOf(a)}</span>
                                <span className="cmap-lib-file-name">{a.name}</span>
                                <span className="cmap-lib-file-meta">{a.ext?.toUpperCase()} {a.size ? formatSize(a.size) : ''}</span>
                              </button>
                            ))}
                            {f && f.items.length < f.total && (
                              <button
                                className="cmap-lib-more"
                                disabled={f.loading}
                                onClick={() => loadFiles(g.series, b.book, f.page + 1, true)}
                              >
                                {f.loading ? '加载中...' : `加载更多（${f.items.length}/${f.total}）`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}




