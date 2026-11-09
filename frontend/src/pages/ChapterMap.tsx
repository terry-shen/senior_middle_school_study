import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubject } from '../contexts/SubjectContext';
import { getLearningMap, getProgress, type LearningProgress, type MapBook } from '../services/learning-api';
import './ChapterMap.css';

export default function ChapterMap() {
  const { token } = useAuth();
  const { selectedSubject } = useSubject();
  const navigate = useNavigate();
  const [books, setBooks] = useState<MapBook[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openBooks, setOpenBooks] = useState<Record<number, boolean>>({});
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [mapRes, progRes] = await Promise.all([getLearningMap(token), getProgress(token)]);
      const data = mapRes.data || [];
      setBooks(data);
      setProgress(progRes.progress || null);

      const first = data[0];
      const nextBooks: Record<number, boolean> = {};
      const nextChapters: Record<number, boolean> = {};
      if (first) {
        nextBooks[first.id] = true;
        if (first.chapters[0]) nextChapters[first.chapters[0].id] = true;
      }
      for (const b of data) {
        for (const c of b.chapters) {
          if (c.sections.some((s) => s.isCurrent)) {
            nextBooks[b.id] = true;
            nextChapters[c.id] = true;
          }
        }
      }
      setOpenBooks(nextBooks);
      setOpenChapters(nextChapters);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBook = (id: number) => setOpenBooks((p) => ({ ...p, [id]: !p[id] }));
  const toggleChapter = (id: number) => setOpenChapters((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="chapter-map">
      <div className="cmap-head">
        <div>
          <h1>📖 章节学习</h1>
          <p className="cmap-sub">
            {selectedSubject ? `${selectedSubject.icon || ''} ${selectedSubject.name}` : '全部学科'}
            <span className="cmap-dot">·</span>
            按教材章节查看视频、讲义、练习与试卷
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

      {!loading && !error && books.length === 0 && (
        <p className="cmap-empty">当前学科暂无章节数据。</p>
      )}

      {!loading && !error && books.map((book) => {
        const isOpen = !!openBooks[book.id];
        const sectionCount = book.chapters.reduce((n, c) => n + c.sections.length, 0);
        return (
          <section key={book.id} className="cmap-book">
            <button className="cmap-book-head" onClick={() => toggleBook(book.id)}>
              <span className="cmap-caret">{isOpen ? '▾' : '▸'}</span>
              <span className="cmap-book-name">{book.name}</span>
              <span className="cmap-book-meta">{book.edition}{book.grade ? ` · ${book.grade}` : ''} · {book.chapters.length} 章 · {sectionCount} 节</span>
            </button>

            {isOpen && (
              <div className="cmap-chapters">
                {book.chapters.map((ch) => {
                  const chOpen = !!openChapters[ch.id];
                  return (
                    <div key={ch.id} className="cmap-chapter">
                      <button className="cmap-chapter-head" onClick={() => toggleChapter(ch.id)}>
                        <span className="cmap-caret">{chOpen ? '▾' : '▸'}</span>
                        <span className="cmap-chapter-title">{ch.title}</span>
                        <span className="cmap-chapter-meta">{ch.sections.length} 节</span>
                      </button>

                      {chOpen && (
                        <ul className="cmap-sections">
                          {ch.sections.map((s) => (
                            <li key={s.id} className={`cmap-section ${s.isCurrent ? 'current' : ''}`}>
                              <Link to={`/learning/section/${s.id}`} className="cmap-section-link">
                                <span className="cmap-section-title">{s.title}</span>
                                <span className="cmap-badges">
                                  <span className="cmap-badge">资源 {s.resourceCount}</span>
                                  {s.paperCount > 0 && <span className="cmap-badge cmap-badge-paper">试卷 {s.paperCount}</span>}
                                  {s.weakCount > 0 && <span className="cmap-badge cmap-badge-weak">薄弱 {s.weakCount}</span>}
                                  {s.isCurrent && <span className="cmap-badge cmap-badge-current">当前</span>}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
