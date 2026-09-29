import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllQuestions, updateQuestion, deleteQuestion, batchDeleteQuestions, getPageImages, reconstructMath, getPapers } from '../services/papers-api';
import type { Question as QuestionType, BlockedItem, ExamPaper } from '../services/papers-api';
import MathText from '../components/MathText';
import './QuestionList.css';

export default function QuestionList() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuestionType>>({});
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'single' | 'batch'; id?: number } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ success: string } | { blocked: BlockedItem[] } | null>(null);
  const [filter, setFilter] = useState({
    type: '',
    difficulty: '',
    paperId: '',
  });
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [showPageImages, setShowPageImages] = useState(false);
  const [reconstructingId, setReconstructingId] = useState<number | null>(null);
  const [reconstructMsg, setReconstructMsg] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadQuestions();
      getPapers(token).then((papersData: any) => {
        const paperList = Array.isArray(papersData) ? papersData : (papersData.data || []);
        setPapers(paperList);
      }).catch(() => {});
    }
  }, [token]);

  const loadQuestions = async () => {
    if (!token) return;
    try {
      const data = await getAllQuestions(token);
      setQuestions(data);
      // Load page images from the first paper if available
      const firstPaperId = data.find(q => q.paperId)?.paperId;
      if (firstPaperId) {
        const images = await getPageImages(token, firstPaperId);
        setPageImages(images);
      }
    } catch (e) {
      console.error('Failed to load questions:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReconstruct = async (questionId: number) => {
    if (!token) return;
    setReconstructingId(questionId);
    setReconstructMsg(null);
    try {
      const result = await reconstructMath(token, questionId);
      if (result.success) {
        setReconstructMsg(`题目 ${questionId} 数学公式重构成功！`);
        await loadQuestions();
      } else {
        setReconstructMsg(`重构失败: ${result.error}`);
      }
    } catch (e: any) {
      setReconstructMsg(`重构失败: ${e.message}`);
    } finally {
      setReconstructingId(null);
      setTimeout(() => setReconstructMsg(null), 5000);
    }
  };

  const handleEdit = (question: QuestionType) => {
    setEditingId(question.id);
    setEditForm({
      content: question.content,
      answer: question.answer,
      difficulty: question.difficulty,
      questionType: question.questionType,
    });
    setEditOptions(isChoiceType(question.questionType) ? getQuestionOptions(question) : []);
  };

  const handleSave = async () => {
    if (!editingId || !token) return;

    try {
      // Serialize edit options to JSON string (backend stores options as String?)
      const payload: Partial<QuestionType> = { ...editForm };
      // Only persist options for choice-like questions (non-choice keep existing value)
      if (isChoiceType(editForm.questionType || '')) {
        payload.options = JSON.stringify(editOptions);
      }
      await updateQuestion(token, editingId, payload);
      await loadQuestions();
      setEditingId(null);
      setEditForm({});
      setEditOptions([]);
    } catch (e) {
      console.error('Failed to update question:', e);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setEditOptions([]);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === filteredQuestions.length) {
        return new Set();
      }
      return new Set(filteredQuestions.map((q) => q.id));
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !token) return;
    try {
      if (confirmDelete.type === 'single' && confirmDelete.id != null) {
        const result = await deleteQuestion(token, confirmDelete.id);
        if (result.success) {
          setDeleteResult({ success: `已删除题目 ${confirmDelete.id}` });
        } else if (result.blocked && result.blocked.length > 0) {
          setDeleteResult({ blocked: result.blocked });
        } else {
          setDeleteResult({ success: '删除完成' });
        }
      } else if (confirmDelete.type === 'batch') {
        const ids = Array.from(selectedIds);
        const result = await batchDeleteQuestions(token, ids);
        if (result.success) {
          setDeleteResult({ success: `已删除 ${result.deleted ?? ids.length} 道题目` });
          clearSelection();
        } else if (result.blocked && result.blocked.length > 0) {
          setDeleteResult({ blocked: result.blocked });
          // Remove successfully deletable ones? No - blocked means whole batch aborted.
          // Keep selection so user can deselect blocked ones and retry.
        } else {
          setDeleteResult({ success: '批量删除完成' });
          clearSelection();
        }
      }
      await loadQuestions();
    } catch (e) {
      setDeleteResult({ success: `删除失败: ${(e as Error).message}` });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleSingleDelete = (id: number) => {
    setDeleteResult(null);
    setConfirmDelete({ type: 'single', id });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteResult(null);
    setConfirmDelete({ type: 'batch' });
  };

  const getQuestionTypeText = (type: string) => {
    const map: Record<string, string> = {
      single_choice: '单选题',
      multiple_choice: '多选题',
      choice: '选择题',
      fill: '填空题',
      essay: '解答题',
      unknown: '未分类',
    };
    return map[type] || type;
  };

  const getDifficultyText = (difficulty?: string) => {
    if (!difficulty) return '-';
    const map: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '较难',
      very_hard: '困难',
    };
    return map[difficulty] || difficulty;
  };

  // Parse options from JSON string or array, returns string[] or null
  const getQuestionOptions = (q: QuestionType): string[] => {
    if (!q.options) return [];
    try {
      const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  // Choice-like question types (selections)
  const isChoiceType = (type: string) =>
    type === 'choice' || type === 'single_choice' || type === 'multiple_choice';

  const filteredQuestions = questions.filter((q) => {
    if (filter.type && q.questionType !== filter.type) return false;
    if (filter.difficulty === 'null') {
      if (q.difficulty) return false; // 只显示未设置难度的题目
    } else if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
    if (filter.paperId && q.paperId !== parseInt(filter.paperId)) return false;
    return true;
  });

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="question-list-container">
      <h1>题目列表</h1>

      <div className="filters">
        {pageImages.length > 0 && (
          <button
            className={`toggle-page-images ${showPageImages ? 'active' : ''}`}
            onClick={() => setShowPageImages(!showPageImages)}
          >
            {showPageImages ? '隐藏原卷页面' : `查看原卷页面 (${pageImages.length}页)`}
          </button>
        )}
        <select
          value={filter.paperId}
          onChange={(e) => setFilter({ ...filter, paperId: e.target.value })}
        >
          <option value="">所有出处</option>
          {papers.map(p => (
            <option key={p.id} value={String(p.id)}>
              {p.title || `试卷 ${p.id}`}
              {(p as any)._count?.questions != null ? `（${(p as any)._count.questions}题）` : ''}
            </option>
          ))}
        </select>

        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
        >
          <option value="">所有题型</option>
          <option value="single_choice">单选题</option>
          <option value="multiple_choice">多选题</option>
          <option value="fill">填空题</option>
          <option value="essay">解答题</option>
          <option value="unknown">未分类</option>
        </select>

        <select
          value={filter.difficulty}
          onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })}
        >
          <option value="">所有难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">较难</option>
          <option value="very_hard">困难</option>
          <option value="null">未设置</option>
        </select>

        {isAdmin && (
          <div className="batch-toolbar">
            <label className="select-all-label">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0}
                onChange={toggleSelectAll}
                disabled={filteredQuestions.length === 0}
              />
              全选
            </label>
            <span className="selected-count">已选 {selectedIds.size} 项</span>
            <button
              onClick={handleBatchDelete}
              className="btn-batch-delete"
              disabled={selectedIds.size === 0}
            >
              批量删除
            </button>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection} className="btn-clear-selection">
                取消选择
              </button>
            )}
          </div>
        )}
      </div>

      {reconstructMsg && (
        <div className="reconstruct-message">{reconstructMsg}</div>
      )}

      {showPageImages && pageImages.length > 0 && (
        <div className="page-images-viewer">
          <h3>原卷页面（含数学公式、数据图表）</h3>
          <div className="page-images-scroll">
            {pageImages.map((imgUrl, idx) => (
              <div key={idx} className="page-image-item">
                <img
                  src={`http://localhost:3000${imgUrl}`}
                  alt={`第${idx + 1}页`}
                  loading="lazy"
                />
                <span className="page-num">第 {idx + 1} 页</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="questions-grid">
        {filteredQuestions.map((question) => (
          <div key={question.id} className="question-card">
            <div className="question-header">
              {isAdmin && editingId !== question.id && (
                <input
                  type="checkbox"
                  className="question-checkbox"
                  checked={selectedIds.has(question.id)}
                  onChange={() => toggleSelect(question.id)}
                />
              )}
              <span className="question-number">{question.questionNumber}</span>
              <span className={`question-type type-${question.questionType}`}>
                {getQuestionTypeText(question.questionType)}
              </span>
              <span className="question-score">{question.score}分</span>
              {question.paper?.title && (
                <span className="question-source" title={`来源试卷: ${question.paper.title}`}>
                  来源: {question.paper.title}
                </span>
              )}
            </div>

            {editingId === question.id ? (
              <div className="edit-form">
                <textarea
                  value={editForm.content || ''}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  placeholder="题目内容"
                />
                <textarea
                  value={editForm.answer || ''}
                  onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                  placeholder="答案"
                />
                {isChoiceType(editForm.questionType || '') && (
                  <div className="edit-options">
                    <div className="edit-options-header">
                      <span>选项</span>
                      <button
                        type="button"
                        className="btn-option-add"
                        onClick={() => setEditOptions([...editOptions, ''])}
                      >
                        + 添加选项
                      </button>
                    </div>
                    {editOptions.map((opt, idx) => (
                      <div key={idx} className="edit-option-row">
                        <span className="option-label">{String.fromCharCode(65 + idx)}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...editOptions];
                            next[idx] = e.target.value;
                            setEditOptions(next);
                          }}
                          placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容`}
                        />
                        {editOptions.length > 2 && (
                          <button
                            type="button"
                            className="btn-option-remove"
                            onClick={() => setEditOptions(editOptions.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <select
                  value={editForm.difficulty || ''}
                  onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                >
                  <option value="">选择难度</option>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">较难</option>
                  <option value="very_hard">困难</option>
                </select>
                <div className="edit-actions">
                  <button onClick={handleSave} className="btn-save">保存</button>
                  <button onClick={handleCancel} className="btn-cancel">取消</button>
                </div>
              </div>
            ) : (
              <>
                {/* 题目内容块 */}
                <div className="question-block question-block-content">
                  <div className="block-label">题目</div>
                  <div className="block-body">
                    <MathText text={question.content} />
                    {getQuestionOptions(question).length > 0 && (
                      <div className="question-options">
                        {getQuestionOptions(question).map((option, idx) => (
                          <div key={idx} className="question-option-item">
                            <span className="option-label">{String.fromCharCode(65 + idx)}.</span>
                            <MathText text={option} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 答案块 */}
                {question.answer && (
                  <div className="question-block question-block-answer">
                    <div className="block-label">答案</div>
                    <div className="block-body">
                      <MathText text={question.answer} />
                    </div>
                  </div>
                )}

                {/* 解析块 */}
                {question.analysis && (
                  <div className="question-block question-block-analysis">
                    <div className="block-label">解析</div>
                    <div className="block-body">
                      <MathText text={question.analysis} />
                    </div>
                  </div>
                )}

                {/* 题目元信息 */}
                <div className="question-meta">
                  <div className="meta-item">
                    <span className="label">难度:</span>
                    <span>{getDifficultyText(question.difficulty)}</span>
                  </div>
                </div>

                <div className="question-actions">
                  <button onClick={() => handleEdit(question)} className="btn-edit">
                    编辑
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleReconstruct(question.id)}
                      className="btn-reconstruct"
                      disabled={reconstructingId === question.id}
                    >
                      {reconstructingId === question.id ? '重构中...' : '数学重构'}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleSingleDelete(question.id)}
                      className="btn-delete-single"
                    >
                      删除
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="empty">暂无题目</div>
      )}

      {confirmDelete && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>确认删除</h3>
            <p>
              {confirmDelete.type === 'single'
                ? `确定要删除题目 ${confirmDelete.id} 吗？此操作不可恢复，关联的答题记录、错题、批改记录等将被级联删除。`
                : `确定要删除选中的 ${selectedIds.size} 道题目吗？此操作不可恢复，所有关联数据将被级联删除。`}
            </p>
            <div className="confirm-actions">
              <button onClick={handleConfirmDelete} className="btn-confirm-delete">确认删除</button>
              <button onClick={() => setConfirmDelete(null)} className="btn-cancel">取消</button>
            </div>
          </div>
        </div>
      )}

      {deleteResult && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>{'success' in deleteResult ? '删除结果' : '部分题目被阻断'}</h3>
            {'success' in deleteResult ? (
              <p className="result-success">{deleteResult.success}</p>
            ) : (
              <div className="result-blocked">
                <p className="blocked-title">
                  以下题目因被进行中的测验/模拟考试引用，无法删除：
                </p>
                <ul className="blocked-list">
                  {deleteResult.blocked.map((b) => (
                    <li key={b.questionId}>
                      <strong>题目 {b.questionId}</strong>
                      <span className="blocked-exam-names">
                        被 {b.examNames.join('、')} 引用
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="blocked-hint">请先完成或删除相关测验后再试。</p>
              </div>
            )}
            <div className="confirm-actions">
              <button onClick={() => setDeleteResult(null)} className="btn-confirm-delete">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}