import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ResourceViewer from '../components/ResourceViewer';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeaturedResources,
  getMoreResources,
  recordProgress,
  type AssetLite,
  type SectionResourcesFeatured,
} from '../services/learning-api';
import './ChapterDetail.css';

const KIND_LABEL: Record<string, string> = {
  video: '视频',
  lecture: '讲义',
  ppt: '课件',
  plan: '复习资料',
  practice: '练习',
  exam: '试卷资料',
  answer: '答案解析',
  audio: '音频',
  image: '图片',
  other: '其他',
};

function formatSize(size: string | null) {
  if (!size) return '';
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function ChapterDetail() {
  const { id } = useParams<{ id: string }>();
  const sectionId = Number(id);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [featured, setFeatured] = useState<SectionResourcesFeatured | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [moreOpen, setMoreOpen] = useState(false);
  const [moreItems, setMoreItems] = useState<AssetLite[]>([]);
  const [morePage, setMorePage] = useState(1);
  const [moreTotal, setMoreTotal] = useState(0);
  const [moreLoading, setMoreLoading] = useState(false);

  const [viewing, setViewing] = useState<AssetLite | null>(null);

  const load = useCallback(async () => {
    if (!token || !sectionId) return;
    setLoading(true);
    setError('');
    try {
      const f = await getFeaturedResources(token, sectionId);
      setFeatured(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async (page: number) => {
    if (!token || !sectionId) return;
    setMoreLoading(true);
    try {
      const res = await getMoreResources(token, sectionId, page, 20);
      setMoreItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setMorePage(res.pagination.page);
      setMoreTotal(res.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载更多资源失败');
    } finally {
      setMoreLoading(false);
    }
  }, [token, sectionId]);

  // 该节没有精选资源时，自动展开「更多资源」，避免学生进入空页
  useEffect(() => {
    if (!featured) return;
    const total = featured.groups.reduce((n, g) => n + g.items.length, 0);
    if (total === 0 && featured.moreCount > 0 && !moreOpen && moreItems.length === 0) {
      setMoreOpen(true);
      loadMore(1);
    }
  }, [featured, moreOpen, moreItems.length, loadMore]);

  const openAsset = async (asset: AssetLite) => {
    setViewing(asset);
    if (!token) return;
    try {
      await recordProgress(token, sectionId, asset.id);
    } catch {
      // 进度记录失败不影响阅读
    }
  };

  if (loading) return <div className="cd-page"><p className="cd-hint">加载中...</p></div>;
  if (error) return <div className="cd-page"><p className="cd-error">{error}</p></div>;
  if (!featured) return <div className="cd-page"><p className="cd-hint">小节不存在。</p></div>;

  const { section, groups, moreCount } = featured;
  const totalFeatured = groups.reduce((n, g) => n + g.items.length, 0);
  const hasMore = moreCount > 0;

  return (
    <div className="cd-page">
      <div className="cd-breadcrumb">
        <Link to="/learning" className="cd-crumb-link">章节学习</Link>
        <span className="cd-crumb-sep">/</span>
        <span>{section.textbookName}</span>
        <span className="cd-crumb-sep">/</span>
        <span>{section.chapterTitle}</span>
      </div>

      <div className="cd-head">
        <div>
          <h1>{section.title}</h1>
          <p className="cd-sub">
            精选资源 {totalFeatured} 条
            {hasMore ? ` · 更多资源 ${moreCount} 条` : ''}
          </p>
        </div>
        <button className="cd-btn" onClick={() => navigate('/learning')}>← 返回章节</button>
      </div>

      {totalFeatured === 0 && !hasMore && (
        <div className="cd-empty">
          <div className="cd-empty-icon">🗂️</div>
          <div>本节暂未配置资源</div>
          <div className="cd-empty-hint">管理员可在「资源映射」中把网盘资源挂到本节</div>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className="cd-group">
          <h2 className="cd-group-title">
            {group.label}
            <span className="cd-group-count">{group.items.length}</span>
          </h2>
          {group.items.length === 0 ? (
            <p className="cd-group-empty">暂无精选{group.label}</p>
          ) : (
            <div className="cd-cards">
              {group.items.map((a) => (
                <button key={a.id} className="cd-card" onClick={() => openAsset(a)}>
                  <div className="cd-card-name" title={a.name}>{a.name}</div>
                  <div className="cd-card-meta">
                    <span className="cd-chip">{KIND_LABEL[a.assetKind] || a.assetKind}</span>
                    {formatSize(a.size) && <span>{formatSize(a.size)}</span>}
                    {a.year && <span>{a.year}</span>}
                    {a.region && <span>{a.region}</span>}
                  </div>
                  <span className="cd-card-action">打开 ›</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      {hasMore && (
        <section className="cd-group">
          <div className="cd-more-head">
            <h2 className="cd-group-title">
              更多资源
              <span className="cd-group-count">{moreTotal || moreCount}</span>
            </h2>
            <button
              className="cd-btn"
              onClick={() => {
                const next = !moreOpen;
                setMoreOpen(next);
                if (next && moreItems.length === 0) loadMore(1);
              }}
            >
              {moreOpen ? '收起' : '展开更多资源'}
            </button>
          </div>

          {moreOpen && (
            <>
              <ul className="cd-more-list">
                {moreItems.map((a) => (
                  <li key={a.id} className="cd-more-item">
                    <button className="cd-more-name" onClick={() => openAsset(a)} title={a.name}>
                      {a.name}
                    </button>
                    <span className="cd-chip">{KIND_LABEL[a.assetKind] || a.assetKind}</span>
                    {a.year && <span className="cd-more-meta">{a.year}</span>}
                    {a.region && <span className="cd-more-meta">{a.region}</span>}
                    {a.series && <span className="cd-more-meta">{a.series}</span>}
                    <span className="cd-more-meta">{formatSize(a.size)}</span>
                  </li>
                ))}
              </ul>
              {moreItems.length < (moreTotal || moreCount) && (
                <button className="cd-btn cd-load-more" onClick={() => loadMore(morePage + 1)} disabled={moreLoading}>
                  {moreLoading ? '加载中...' : '加载更多'}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <ResourceViewer asset={viewing} token={token || ''} onClose={() => setViewing(null)} />
    </div>
  );
}
