/**
 * 学生错题本主页面
 *
 * - 录入入口（拍照/手动）
 * - 掌握度概览（按标签分组）
 * - 默认/全量视图切换
 * - 错题卡片列表（多维筛选）
 * - 重练/标记掌握/编辑/删除/打印入口
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import MathText from '../components/MathText';
import {
  getWrongQuestions,
  getMasteryOverview,
  deleteWrongQuestion,
  setMastered,
  createPhotoWrongQuestion,
  normalizeImageUrl,
  parseOptions,
  type StudentWrongQuestion,
  type MasteryOverview,
  type ViewMode,
} from '../services/wrong-questions-api';
import './WrongQuestionBook.css';

const QUESTION_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: '全部题型' },
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'fill', label: '填空题' },
  { value: 'essay', label: '解答题' },
  { value: 'unknown', label: '未分类' },
];

const DIFFICULTIES: { value: string; label: string }[] = [
  { value: 'all', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '较难' },
  { value: 'very_hard', label: '困难' },
  { value: 'unknown', label: '未设置' },
];

function typeLabel(t: string): string {
  return QUESTION_TYPES.find((x) => x.value === t)?.label || t;
}
function diffLabel(d: string): string {
  return DIFFICULTIES.find((x) => x.value === d)?.label || d;
}

export default function WrongQuestionBook() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<StudentWrongQuestion[]>([]);
  const [overview, setOverview] = useState<MasteryOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('unmastered');
  const [filterType, setFilterType] = useState('all');
  const [filterDiff, setFilterDiff] = useState('all');
  const [filterTag, setFilterTag] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [photoUploading, setPhotoUploading] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [listRes, ov] = await Promise.all([
        getWrongQuestions(token, {
          viewMode,
          questionType: filterType,
          difficulty: filterDiff,
          tag: filterTag,
          page: 1,
          limit: 50,
        }),
        getMasteryOverview(token),
      ]);
      setQuestions(listRes.data || []);
      setOverview(ov);
    } catch (e: any) {
      showToast('error', e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, viewMode, filterType, filterDiff, filterTag]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setPhotoUploading(true);
    try {
      const result = await createPhotoWrongQuestion(token, file, {
        questionType: 'unknown',
        difficulty: 'unknown',
      });
      if (result.success) {
        showToast('success', '拍照错题已上传，可补充题面内容');
        navigate(`/wrong-questions/edit/${result.wrongQuestion.id}`);
      } else {
        showToast('error', '上传失败');
      }
      loadData();
    } catch (err: any) {
      showToast('error', err.message || '上传失败');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm('确定删除这道错题？')) return;
    try {
      await deleteWrongQuestion(token, id);
      showToast('success', '已删除');
      loadData();
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleToggleMastered = async (q: StudentWrongQuestion) => {
    if (!token) return;
    const mastered = q.reviewStatus !== 'mastered';
    try {
      await setMastered(token, q.id, mastered);
      showToast('success', mastered ? '已标记为掌握' : '已取消掌握');
      loadData();
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      showToast('error', '请先勾选要打印的错题');
      return;
    }
    const ids = Array.from(selectedIds).join(',');
    navigate(`/wrong-questions/print?ids=${ids}`);
  };

  const unmasteredCount = overview
    ? overview.overall.total - overview.overall.mastered
    : 0;

  return (
    <div className="wrong-question-book">
      <header className="wq-header">
        <h1>错题本</h1>
        <div className="wq-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary"
            disabled={photoUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            拍照录入
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/wrong-questions/edit')}
          >
            手动录入
          </button>
          <button
            className="btn btn-print"
            disabled={selectedIds.size === 0}
            onClick={handlePrint}
          >
            打印选中 ({selectedIds.size})
          </button>
        </div>
      </header>

      {overview && (
        <section className="mastery-overview">
          <div className="overall-card">
            <div className="overall-label">总体掌握度</div>
            <div className="overall-value">{overview.overall.mastery}%</div>
            <div className="overall-meta">
              已掌握 {overview.overall.mastered} / {overview.overall.total}
            </div>
          </div>
          <div className="mastery-groups">
            {overview.groups.length === 0 && (
              <div className="empty-hint">暂无错题，点击上方按钮开始录入</div>
            )}
            {overview.groups.map((g) => (
              <div
                key={g.tag}
                className={`mastery-group ${g.weak ? 'weak' : ''}`}
                onClick={() => setFilterTag(g.tag === '未分类' ? '' : g.tag)}
                title="点击按此标签筛选"
              >
                <div className="group-tag">{g.tag}</div>
                <div className="group-bar">
                  <div
                    className="group-bar-fill"
                    style={{ width: `${g.mastery}%` }}
                  />
                </div>
                <div className="group-meta">
                  {g.mastered}/{g.total} · {g.mastery}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="wq-filters">
        <div className="view-tabs">
          <button
            className={viewMode === 'unmastered' ? 'tab active' : 'tab'}
            onClick={() => setViewMode('unmastered')}
          >
            未掌握 ({unmasteredCount})
          </button>
          <button
            className={viewMode === 'all' ? 'tab active' : 'tab'}
            onClick={() => setViewMode('all')}
          >
            全部 ({overview?.overall.total ?? 0})
          </button>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterDiff}
          onChange={(e) => setFilterDiff(e.target.value)}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="知识点标签搜索"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
        />
        {(filterType !== 'all' || filterDiff !== 'all' || filterTag) && (
          <button
            className="btn-clear"
            onClick={() => {
              setFilterType('all');
              setFilterDiff('all');
              setFilterTag('');
            }}
          >
            清除筛选
          </button>
        )}
      </section>

      <section className="wq-list">
        {loading && <div className="loading">加载中...</div>}
        {!loading && questions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div>暂无错题记录</div>
            <div className="empty-hint">
              点击上方拍照录入或手动录入开始
            </div>
          </div>
        )}
        {questions.map((q) => {
          const opts = parseOptions(q.options);
          const imgUrl = normalizeImageUrl(q.imageUrl);
          return (
            <div
              key={q.id}
              className={`wq-card ${q.reviewStatus === 'mastered' ? 'mastered' : ''}`}
            >
              <div className="wq-card-header">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(q.id)}
                    onChange={() => toggleSelect(q.id)}
                  />
                </label>
                <span className="wq-source">
                  {q.source === 'photo' ? '拍照' : '手动'}
                </span>
                <span className="wq-type-badge">{typeLabel(q.questionType)}</span>
                <span className="wq-diff-badge">{diffLabel(q.difficulty)}</span>
                {q.knowledgePointTags && (
                  <span className="wq-tag-badge">标签 {q.knowledgePointTags}</span>
                )}
                {q.reviewStatus === 'mastered' && (
                  <span className="wq-mastered-badge">已掌握</span>
                )}
                <span className="wq-meta">
                  错 {q.wrongCount} 次 ·{' '}
                  {new Date(q.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="wq-card-body">
                {imgUrl && (
                  <div className="wq-image">
                    <img src={imgUrl} alt="错题图片" />
                  </div>
                )}
                {q.content && (
                  <div className="wq-content">
                    <MathText text={q.content} />
                  </div>
                )}
                {!imgUrl && !q.content && (
                  <div className="wq-empty-content">尚未补录题面</div>
                )}
                {opts.length > 0 && (
                  <div className="wq-options">
                    {opts.map((opt, idx) => (
                      <div key={idx} className="wq-option">
                        <span className="option-label">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <MathText text={opt} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="wq-card-actions">
                <button
                  className="btn-link"
                  onClick={() => navigate(`/wrong-questions/practice/${q.id}`)}
                >
                  重练
                </button>
                <button
                  className="btn-link"
                  onClick={() => navigate(`/wrong-questions/edit/${q.id}`)}
                >
                  {q.source === 'photo' && !q.content ? '补录题面' : '编辑'}
                </button>
                <button
                  className="btn-link"
                  onClick={() => handleToggleMastered(q)}
                >
                  {q.reviewStatus === 'mastered' ? '取消掌握' : '标记掌握'}
                </button>
                <button
                  className="btn-link danger"
                  onClick={() => handleDelete(q.id)}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
