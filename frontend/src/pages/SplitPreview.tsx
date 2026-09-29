import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  splitPreview,
  confirmImport,
  enrichPaper,
  getEnrichmentStatus,
  setEnrichmentProposalStatus,
  type SplitPreviewQuestion,
  type EnrichmentProposal,
} from '../services/papers-api';
import MathText from '../components/MathText';
import './SplitPreview.css';

export default function SplitPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const paperId = parseInt(id || '0');

  const [questions, setQuestions] = useState<SplitPreviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');

  // AI 忠实还原清洗状态
  const [enriching, setEnriching] = useState(false);
  const [proposals, setProposals] = useState<EnrichmentProposal[]>([]);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ content: '', correctAnswer: '', analysis: '', questionType: '' });
  const [editOptions, setEditOptions] = useState<string[]>([]);

  const isChoiceType = (type: string) => type === 'choice' || type === 'single_choice' || type === 'multiple_choice';

  const getQuestionOptions = (q: SplitPreviewQuestion): string[] => {
    if (!q.options) return [];
    if (Array.isArray(q.options)) return q.options;
    try {
      const parsed = JSON.parse(q.options as unknown as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  useEffect(() => {
    if (!token || !paperId) return;
    setLoading(true);
    splitPreview(token, paperId).then(data => {
      if (data.success && data.questions) {
        setQuestions(data.questions);
        setSource(data.source || '');
      } else {
        setError(data.error || '拆分预览失败');
      }
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [token, paperId]);

  // 若该卷已有清洗提议（例如刷新页面），加载进来
  useEffect(() => {
    if (!token || !paperId) return;
    getEnrichmentStatus(token, paperId)
      .then(status => {
        if (status.proposals.length > 0) {
          setProposals(status.proposals);
        }
      })
      .catch(() => { /* 无提议时忽略 */ });
  }, [token, paperId]);

  const handleEdit = (q: SplitPreviewQuestion) => {
    setEditingId(q.questionNumber);
    setEditForm({
      content: q.content,
      correctAnswer: q.correctAnswer || '',
      analysis: q.analysis || '',
      questionType: q.questionType || 'unknown',
    });
    setEditOptions(isChoiceType(q.questionType) ? getQuestionOptions(q) : []);
  };

  const handleSaveEdit = (questionNumber: number) => {
    let options: string[] | undefined = undefined;
    if (isChoiceType(editForm.questionType)) {
      options = editOptions;
    }
    setQuestions(prev => prev.map(q =>
      q.questionNumber === questionNumber
        ? { ...q, content: editForm.content, correctAnswer: editForm.correctAnswer, analysis: editForm.analysis, questionType: editForm.questionType, options }
        : q
    ));
    setEditingId(null);
    setEditOptions([]);
  };

  // ---- AI 忠实还原清洗 ----
  const handleEnrich = async () => {
    if (!token || !paperId) return;
    setEnriching(true);
    setError('');
    setEnrichMessage('');
    setShowConfirmPrompt(false);
    try {
      const result = await enrichPaper(token, paperId);
      if (result.success && result.summary) {
        setEnrichMessage(
          `清洗完成：共 ${result.summary.total} 题，${result.summary.changed} 题有修改，` +
          `${result.summary.failed} 题失败（保留原文），${result.summary.unchanged} 题无需修改。`
        );
        const status = await getEnrichmentStatus(token, paperId);
        setProposals(status.proposals);
      } else {
        setError(result.error || 'AI 清洗失败');
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setEnriching(false);
  };

  const handleProposalDecision = async (questionNumber: number, status: 'accepted' | 'rejected') => {
    if (!token || !paperId) return;
    try {
      await setEnrichmentProposalStatus(token, paperId, questionNumber, status);
      setProposals(prev => prev.map(p =>
        p.questionNumber === questionNumber ? { ...p, status } : p
      ));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
  const pendingChangedProposals = proposals.filter(p =>
    p.changes.length > 0 && p.status === 'pending'
  );

  const handleConfirm = async () => {
    if (!token || !paperId) return;
    // 4.4: 有已接受的清洗提议时，先展示汇总确认
    if (acceptedCount > 0 && !showConfirmPrompt) {
      setShowConfirmPrompt(true);
      return;
    }
    setConfirming(true);
    try {
      // 提交人工校准后的题目数据（含选项编辑），后端按题号保存；若用户未编辑任何内容，
      // 后端将回退到基于 markdown 的标签拆分。
      const result = await confirmImport(token, paperId, questions);
      if (result.success) {
        if (result.appliedCleanings && result.appliedCleanings > 0) {
          setEnrichMessage(`已应用 ${result.appliedCleanings} 项 AI 清洗结果`);
        }
        navigate('/questions');
      } else {
        setError(result.error || '确认导入失败');
        setConfirming(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setConfirming(false);
    }
  };

  if (loading) return <div className="split-preview-loading">正在拆分预览...</div>;

  return (
    <div className="split-preview-page">
      <div className="split-preview-header">
        <h1>拆分预览 ({questions.length} 题)</h1>
        <div className="header-actions">
          {source && <span className="source-badge">来源: {source === 'edited' ? '校准版' : '原始版'}</span>}
          {acceptedCount > 0 && <span className="clean-accepted-badge">已接受 {acceptedCount}/{proposals.filter(p => p.changes.length > 0).length}</span>}
          <button className="btn btn-secondary" onClick={() => navigate(`/papers/${paperId}/edit`)} disabled={enriching}>重新编辑</button>
          <button className="btn btn-enrich" onClick={handleEnrich} disabled={enriching || confirming}>
            {enriching ? 'AI 清洗中...' : 'AI 清洗（忠实还原）'}
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming || enriching}>
            {confirming ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {enrichMessage && <div className="info-banner">{enrichMessage}</div>}

      {enriching && (
        <div className="enrich-progress-banner">
          <span className="spinner" /> 正在 AI 清洗 OCR 噪声（忠实还原），共 {questions.length} 题，约 10–60 分钟，请保持本页打开不要重复点击…
        </div>
      )}

      {showConfirmPrompt && (
        <div className="confirm-prompt-box">
          <div className="confirm-prompt-text">
            将导入 <strong>{questions.length}</strong> 道题，其中 <strong>{acceptedCount}</strong> 道应用 AI 清洗结果，
            <strong>{proposals.filter(p => p.changes.length > 0 && p.status === 'rejected').length}</strong> 道保持原文（驳回）。
            有 <strong>{pendingChangedProposals.length}</strong> 道待复核提议尚未处理。确认导入？
          </div>
          <div className="confirm-prompt-actions">
            <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
              {confirming ? '导入中...' : '确认导入'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowConfirmPrompt(false)}>取消</button>
          </div>
        </div>
      )}

      {/* AI 清洗提议区（4.2/4.3） */}
      {proposals.length > 0 && (
        <div className="enrich-section">
          <div className="enrich-section-header">
            <h2>AI 清洗提议</h2>
            <span className="enrich-section-sub">仅修正 OCR 噪声与格式，人工逐题确认后才生效</span>
          </div>
          {proposals.map(p => {
            const changed = p.changes.length > 0;
            const needsReview = p.confidence > 0 && p.confidence < 0.7;
            return (
              <div key={p.questionNumber} className={`enrich-proposal ${changed ? '' : 'enrich-proposal-unchanged'}`}>
                <div className="enrich-proposal-header">
                  <span className="question-number">第 {p.questionNumber} 题</span>
                  {!changed && <span className="proposal-chip chip-nochange">无需修改</span>}
                  {changed && p.status === 'pending' && <span className="proposal-chip chip-pending">待确认</span>}
                  {changed && p.status === 'accepted' && <span className="proposal-chip chip-accepted">已接受</span>}
                  {changed && p.status === 'rejected' && <span className="proposal-chip chip-rejected">已驳回</span>}
                  {needsReview && <span className="proposal-chip chip-review">需复核</span>}
                </div>

                {!changed ? (
                  <div className="enrich-unchanged-note">清洗后无修改，保持 MinerU 原文。</div>
                ) : (
                  <>
                    <div className="enrich-diff">
                      <div className="enrich-panel">
                        <div className="enrich-panel-title">原文 (MinerU)</div>
                        <div className="enrich-panel-content"><MathText text={p.originalText} /></div>
                      </div>
                      <div className="enrich-panel enrich-panel-cleaned">
                        <div className="enrich-panel-title">清洗后</div>
                        <div className="enrich-panel-content"><MathText text={p.cleanedText} /></div>
                      </div>
                    </div>
                    {p.changes.length > 0 && (
                      <ul className="enrich-changes">
                        {p.changes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    )}
                    <div className="enrich-actions">
                      <button
                        className={`btn btn-accept ${p.status === 'accepted' ? 'btn-active' : ''}`}
                        onClick={() => handleProposalDecision(p.questionNumber, 'accepted')}
                        disabled={p.status === 'accepted'}
                      >接受</button>
                      <button
                        className={`btn btn-reject ${p.status === 'rejected' ? 'btn-active' : ''}`}
                        onClick={() => handleProposalDecision(p.questionNumber, 'rejected')}
                        disabled={p.status === 'rejected'}
                      >驳回</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="questions-list">
        {questions.map((q, idx) => (
          <div key={idx} className="question-card">
            {editingId === q.questionNumber ? (
              <div className="edit-mode">
                <div className="edit-header">编辑题目 {q.questionNumber}</div>
                <label>题目内容:</label>
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                  rows={5}
                />
                <label>答案:</label>
                <input
                  value={editForm.correctAnswer}
                  onChange={e => setEditForm({ ...editForm, correctAnswer: e.target.value })}
                />
                <label>解析:</label>
                <textarea
                  value={editForm.analysis}
                  onChange={e => setEditForm({ ...editForm, analysis: e.target.value })}
                  rows={5}
                />
                <label>题型:</label>
                <select
                  value={editForm.questionType}
                  onChange={e => setEditForm({ ...editForm, questionType: e.target.value })}
                  className="type-select"
                >
                  <option value="single_choice">单选题</option>
                  <option value="multiple_choice">多选题</option>
                  <option value="fill">填空题</option>
                  <option value="essay">解答题</option>
                  <option value="unknown">未分类</option>
                </select>
                {isChoiceType(editForm.questionType) && (
                  <div className="edit-options">
                    <div className="edit-options-header">
                      <span>选项</span>
                      <button className="btn-option-add" onClick={() => setEditOptions([...editOptions, ''])}>+ 添加选项</button>
                    </div>
                    {editOptions.map((opt, idx) => (
                      <div key={idx} className="edit-option-row">
                        <span className="option-label">{String.fromCharCode(65 + idx)}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={e => {
                            const next = [...editOptions];
                            next[idx] = e.target.value;
                            setEditOptions(next);
                          }}
                          placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容`}
                        />
                        {editOptions.length > 2 && (
                          <button className="btn-option-remove" onClick={() => setEditOptions(editOptions.filter((_, i) => i !== idx))}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="edit-actions">
                  <button className="btn btn-primary" onClick={() => handleSaveEdit(q.questionNumber)}>保存</button>
                  <button className="btn btn-secondary" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className="question-header">
                  <span className="question-number">第 {q.questionNumber} 题</span>
                  <span className="question-type">{({single_choice:'单选题',multiple_choice:'多选题',choice:'选择题',fill:'填空题',essay:'解答题',unknown:'未分类'} as Record<string,string>)[q.questionType||'unknown'] || q.questionType}</span>
                  <button className="btn-edit" onClick={() => handleEdit(q)}>编辑</button>
                </div>
                <div className="question-block">
                  <div className="block-header blue">题目</div>
                  <div className="block-content"><MathText text={q.content} /></div>
                </div>
                {getQuestionOptions(q).length > 0 && (
                  <div className="question-block">
                    <div className="block-header blue">选项</div>
                    <div className="block-content">
                      {getQuestionOptions(q).map((opt, oi) => (
                        <div key={oi} className="preview-option-row">
                          <span className="option-label">{String.fromCharCode(65 + oi)}.</span>
                          <MathText text={opt} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {q.correctAnswer && (
                  <div className="question-block">
                    <div className="block-header green">答案</div>
                    <div className="block-content"><MathText text={q.correctAnswer} /></div>
                  </div>
                )}
                {q.analysis && (
                  <div className="question-block">
                    <div className="block-header orange">解析</div>
                    <div className="block-content"><MathText text={q.analysis} /></div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}