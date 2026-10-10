import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MathText from '../components/MathText';
import {
  getStudentWrongQuestionsForAdmin,
  getStudentMasteryOverviewForAdmin,
  type StudentWrongQuestion,
  type WrongQuestionsResult,
  type MasteryOverview,
  type ViewMode,
} from '../services/wrong-questions-api';
import './AdminWrongQuestionView.css';

const statusLabels: Record<string, string> = { new: '未复习', reviewing: '复习中', mastered: '已掌握' };
const typeLabels: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  choice: '选择题',
  fill: '填空题',
  essay: '解答题',
  unknown: '未分类',
};

function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function AdminWrongQuestionView() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const studentId = Number(params.id);

  const [list, setList] = useState<WrongQuestionsResult | null>(null);
  const [overview, setOverview] = useState<MasteryOverview | null>(null);
  const [reviewStatus, setReviewStatus] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('unmastered');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !studentId) return;
    setLoading(true);
    setError('');
    try {
      const [data, ov] = await Promise.all([
        getStudentWrongQuestionsForAdmin(token, studentId, {
          reviewStatus: reviewStatus || undefined,
          viewMode,
          page,
          limit: 20,
        }),
        getStudentMasteryOverviewForAdmin(token, studentId),
      ]);
      setList(data);
      setOverview(ov);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, studentId, reviewStatus, viewMode, page]);

  useEffect(() => {
    load();
  }, [load]);

  const renderQuestionCard = (q: StudentWrongQuestion) => {
    const options = parseJsonArray(q.options);
    return (
      <div key={q.id} className="awq-card">
        <div className="awq-card-header">
          <span className={`awq-status status-${q.reviewStatus}`}>{statusLabels[q.reviewStatus] || q.reviewStatus}</span>
          <span className="awq-meta">{typeLabels[q.questionType] || q.questionType}</span>
          <span className="awq-meta">{q.difficulty || '未设置难度'}</span>
          <span className="awq-meta">错 {q.wrongCount} 次</span>
          <span className="awq-meta">{q.source === 'photo' ? '📷 拍照' : '✏️ 手动'}</span>
          <span className="awq-date">{new Date(q.createdAt).toLocaleDateString()}</span>
        </div>
        {q.imageUrl && <img className="awq-image" src={q.imageUrl} alt="错题图片" />}
        {q.content && (
          <div className="awq-content">
            <MathText text={q.content} />
          </div>
        )}
        {options.length > 0 && (
          <div className="awq-options">
            {options.map((opt, i) => (
              <div key={i} className="awq-option-row">
                <span className="awq-option-label">{String.fromCharCode(65 + i)}.</span>
                <MathText text={opt} />
              </div>
            ))}
          </div>
        )}
        <div className="awq-answers">
          {q.myAnswer && <div className="awq-answer-row"><span className="awq-answer-label my">我的答案</span><MathText text={q.myAnswer} /></div>}
          {q.correctAnswer && <div className="awq-answer-row"><span className="awq-answer-label correct">正确答案</span><MathText text={q.correctAnswer} /></div>}
        </div>
        {q.analysis && (
          <div className="awq-analysis"><MathText text={q.analysis} /></div>
        )}
        {q.knowledgePointTags && parseJsonArray(q.knowledgePointTags).length > 0 && (
          <div className="awq-tags">
            {parseJsonArray(q.knowledgePointTags).map((t, i) => (
              <span key={i} className="awq-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!studentId) return <div className="awq-page"><p>无效的学生ID</p></div>;

  return (
    <div className="awq-page">
      <div className="awq-header">
        <div>
          <h1>学生错题本（只读）</h1>
          <p className="awq-sub">学生 ID: {studentId}</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate(-1)}>返回</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {overview && (
        <div className="awq-overview">
          <div className="awq-overall">
            <span>总错题 {overview.overall?.total ?? 0}</span>
            <span>已掌握 {overview.overall?.mastered ?? 0}</span>
            <span>掌握度 {overview.overall?.mastery ?? 0}%</span>
          </div>
          {overview.groups && overview.groups.length > 0 && (
            <div className="awq-groups">
              {overview.groups.map((g) => (
                <span key={g.tag} className={`awq-group-chip ${g.weak ? 'weak' : ''}`}>
                  {g.tag}: {g.mastered}/{g.total}（{g.mastery}%）
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="awq-filters">
        <select value={viewMode} onChange={(e) => { setViewMode(e.target.value as ViewMode); setPage(1); }}>
          <option value="unmastered">未掌握</option>
          <option value="all">全部</option>
        </select>
        <select value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="new">未复习</option>
          <option value="reviewing">复习中</option>
          <option value="mastered">已掌握</option>
        </select>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : !list || list.data.length === 0 ? (
        <p className="awq-empty">该学生暂无错题记录</p>
      ) : (
        <>
          {list.data.map(renderQuestionCard)}
          {list.pagination.totalPages > 1 && (
            <div className="awq-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
              <span>{page} / {list.pagination.totalPages}（共 {list.pagination.total} 条）</span>
              <button disabled={page >= list.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
