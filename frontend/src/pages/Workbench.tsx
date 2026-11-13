import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getTaxonomyTree, type TextbookNode } from '../services/chapters-api';
import { getIndexStats, type IndexStats } from '../services/netdisk-index-api';
import {
  getLearningSubjects,
  getProgress,
  getRecentOpens,
  getViewedSectionCounts,
  type LearningProgress,
  type LearningSubject,
  type RecentOpen,
} from '../services/learning-api';
import './Workbench.css';

interface AdminStats {
  books: number;
  chapters: number;
  sections: number;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export default function Workbench() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats>({ books: 0, chapters: 0, sections: 0 });
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);

  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [viewed, setViewed] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<RecentOpen[]>([]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);

    const loadAdmin = async () => {
      const [treeRes, statsRes] = await Promise.allSettled([getTaxonomyTree(token), getIndexStats(token)]);
      if (!alive) return;
      if (treeRes.status === 'fulfilled') {
        const books = treeRes.value as TextbookNode[];
        setAdminStats({
          books: books.length,
          chapters: books.reduce((n, b) => n + b.chapterCount, 0),
          sections: books.reduce((n, b) => n + b.sectionCount, 0),
        });
      }
      if (statsRes.status === 'fulfilled') setIndexStats(statsRes.value as IndexStats);
    };

    const loadStudent = async () => {
      const [subjRes, progRes, viewedRes, recentRes] = await Promise.allSettled([
        getLearningSubjects(token),
        getProgress(token),
        getViewedSectionCounts(token),
        getRecentOpens(token, 5),
      ]);
      if (!alive) return;
      if (subjRes.status === 'fulfilled') setSubjects(subjRes.value.data ?? []);
      if (progRes.status === 'fulfilled') setProgress(progRes.value.progress ?? null);
      if (viewedRes.status === 'fulfilled') setViewed(viewedRes.value.data ?? {});
      if (recentRes.status === 'fulfilled') setRecent(recentRes.value.data ?? []);
    };

    (isAdmin ? loadAdmin() : loadStudent()).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [token, isAdmin]);

  if (isAdmin) {
    return (
      <div className="wb-page">
        <div className="wb-head">
          <h1>工作台</h1>
          <p className="wb-sub">章节学习内容概览与网盘资源索引状态</p>
        </div>

        <section className="wb-block">
          <h2 className="wb-block-title">📚 教材章节</h2>
          <div className="wb-cards">
            <Link to="/chapters" className="wb-card">
              <div className="wb-card-num">{adminStats.books}</div>
              <div className="wb-card-label">册</div>
            </Link>
            <Link to="/chapters" className="wb-card">
              <div className="wb-card-num">{adminStats.chapters}</div>
              <div className="wb-card-label">章</div>
            </Link>
            <Link to="/chapters" className="wb-card">
              <div className="wb-card-num">{adminStats.sections}</div>
              <div className="wb-card-label">节</div>
            </Link>
          </div>
        </section>

        <section className="wb-block">
          <h2 className="wb-block-title">🧭 网盘资源索引</h2>
          {indexStats ? (
            <div className="wb-cards">
              <Link to="/netdisk-index" className="wb-card">
                <div className="wb-card-num">{indexStats.total}</div>
                <div className="wb-card-label">已索引文件</div>
              </Link>
              <Link to="/netdisk-index" className="wb-card">
                <div className="wb-card-num">{indexStats.mapped}</div>
                <div className="wb-card-label">已挂章节</div>
              </Link>
              <Link to="/netdisk-index" className="wb-card">
                <div className="wb-card-num">{indexStats.unmapped}</div>
                <div className="wb-card-label">未映射</div>
              </Link>
            </div>
          ) : (
            <p className="wb-empty">资源索引暂不可用</p>
          )}
        </section>

        <section className="wb-block">
          <h2 className="wb-block-title">快捷入口</h2>
          <div className="wb-links">
            <Link to="/chapters" className="wb-link">🗂️ 章节管理</Link>
            <Link to="/netdisk-index" className="wb-link">🧭 资源映射</Link>
            <Link to="/resources" className="wb-link">📺 学习资源</Link>
            <Link to="/students" className="wb-link">👥 学生列表</Link>
            <Link to="/settings/netdisk" className="wb-link">☁️ 网盘绑定</Link>
          </div>
        </section>

        {loading && <p className="wb-loading">加载中...</p>}
      </div>
    );
  }

  return (
    <div className="wb-page">
      <div className="wb-head">
        <h1>工作台</h1>
        <p className="wb-sub">继续上次的学习，或按学科进入章节学习</p>
      </div>

      <section className="wb-block">
        <h2 className="wb-block-title">📖 继续学习</h2>
        {progress ? (
          <div className="wb-continue">
            <div className="wb-continue-path">
              {progress.textbookName} / {progress.chapterTitle} / <strong>{progress.sectionTitle}</strong>
            </div>
            <div className="wb-continue-meta">
              {progress.assetName ? `上次查看：${progress.assetName}` : '上次学习位置'}
              {progress.updatedAt ? ` · ${formatTime(progress.updatedAt)}` : ''}
            </div>
            <Link className="wb-btn wb-btn-primary" to={`/learning/section/${progress.sectionId}`}>
              继续学习 →
            </Link>
          </div>
        ) : (
          <p className="wb-empty">
            还没有学习记录，去 <Link to="/learning" className="wb-inline-link">章节学习</Link> 开始吧
          </p>
        )}
      </section>

      <section className="wb-block">
        <h2 className="wb-block-title">🧭 我的学科</h2>
        <div className="wb-subjects">
          {subjects.map((s) => {
            const pending = s.sectionCount === 0 && (s.videoCount ?? 0) === 0;
            const viewedCount = viewed[String(s.id)] || 0;
            const inner = (
              <>
                <div className="wb-subject-head">
                  <span className="wb-subject-icon">{s.icon || '📘'}</span>
                  <span className="wb-subject-name">{s.name}</span>
                  {pending && <span className="wb-subject-pending">待建设</span>}
                </div>
                <div className="wb-subject-meta">
                  {pending
                    ? '内容准备中'
                    : s.sectionCount > 0
                      ? `${s.sectionCount} 节 · 已浏览 ${viewedCount} 节`
                      : `${s.videoCount} 个视频`}
                </div>
              </>
            );
            return pending ? (
              <div
                key={s.id}
                className="wb-subject wb-subject-disabled"
                style={{ ['--subject-color' as string]: s.color || '#9ca3af' }}
              >
                {inner}
              </div>
            ) : (
              <Link
                key={s.id}
                to={`/learning/${s.code}`}
                className="wb-subject"
                style={{ ['--subject-color' as string]: s.color || '#2563eb' }}
                onClick={() => {
                  localStorage.setItem('learningSubjectId', String(s.id));
                  localStorage.setItem('learningSubjectCode', s.code);
                }}
              >
                {inner}
              </Link>
            );
          })}
          {subjects.length === 0 && <p className="wb-empty">暂无学科</p>}
        </div>
      </section>

      <section className="wb-block">
        <h2 className="wb-block-title">🕒 最近打开</h2>
        {recent.length === 0 ? (
          <p className="wb-empty">暂无浏览记录</p>
        ) : (
          <ul className="wb-recent">
            {recent.map((r) => (
              <li key={`${r.sectionId}-${r.assetId ?? 0}`} className="wb-recent-item">
                <Link to={`/learning/section/${r.sectionId}`} className="wb-recent-name" title={r.assetName || ''}>
                  {r.assetName || r.sectionTitle}
                </Link>
                <span className="wb-recent-section">{r.sectionTitle}</span>
                <span className="wb-recent-time">{formatTime(r.openedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loading && <p className="wb-loading">加载中...</p>}
    </div>
  );
}
