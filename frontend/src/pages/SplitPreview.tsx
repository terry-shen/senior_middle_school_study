import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { splitPreview, confirmImport, type SplitPreviewQuestion } from '../services/papers-api';
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ content: '', correctAnswer: '', analysis: '' });

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

  const handleEdit = (q: SplitPreviewQuestion) => {
    setEditingId(q.questionNumber);
    setEditForm({
      content: q.content,
      correctAnswer: q.correctAnswer || '',
      analysis: q.analysis || '',
    });
  };

  const handleSaveEdit = (questionNumber: number) => {
    setQuestions(prev => prev.map(q =>
      q.questionNumber === questionNumber
        ? { ...q, content: editForm.content, correctAnswer: editForm.correctAnswer, analysis: editForm.analysis }
        : q
    ));
    setEditingId(null);
  };

  const handleConfirm = async () => {
    if (!token || !paperId) return;
    setConfirming(true);
    try {
      const result = await confirmImport(token, paperId);
      if (result.success) {
        navigate('/questions');
      } else {
        setError(result.error || '确认导入失败');
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setConfirming(false);
  };

  if (loading) return <div className="split-preview-loading">正在拆分预览...</div>;

  return (
    <div className="split-preview-page">
      <div className="split-preview-header">
        <h1>拆分预览 ({questions.length} 题)</h1>
        <div className="header-actions">
          {source && <span className="source-badge">来源: {source === 'edited' ? '校准版' : '原始版'}</span>}
          <button className="btn btn-secondary" onClick={() => navigate(`/papers/${paperId}/edit`)}>重新编辑</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
            {confirming ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

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
                <div className="edit-actions">
                  <button className="btn btn-primary" onClick={() => handleSaveEdit(q.questionNumber)}>保存</button>
                  <button className="btn btn-secondary" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className="question-header">
                  <span className="question-number">第 {q.questionNumber} 题</span>
                  <span className="question-type">{q.questionType}</span>
                  <button className="btn-edit" onClick={() => handleEdit(q)}>编辑</button>
                </div>
                <div className="question-block">
                  <div className="block-header blue">题目</div>
                  <div className="block-content"><MathText text={q.content} /></div>
                </div>
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
