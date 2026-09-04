import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getWrongQuestions,
  getWrongQuestionStats,
  updateReviewStatus,
  recordPractice,
  generateVariation,
  type WrongQuestion,
  type WrongQuestionStats,
} from '../services/wrong-questions-api';
import './WrongQuestionBook.css';

export default function WrongQuestionBook() {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [stats, setStats] = useState<WrongQuestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'practice' | 'stats'>('list');
  const [filters, setFilters] = useState({
    reviewStatus: '',
    questionType: '',
    difficulty: '',
  });
  const [selectedQuestion, setSelectedQuestion] = useState<WrongQuestion | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState<boolean | null>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [showNotes, setShowNotes] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (token) loadData();
  }, [filters, token]);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [q, s] = await Promise.all([
        getWrongQuestions(token, filters),
        getWrongQuestionStats(token),
      ]);
      setQuestions(q);
      setStats(s);
    } catch (e) {
      console.error('Failed to load wrong questions:', e);
    }
    setLoading(false);
  }

  async function handlePractice(wrongQ: WrongQuestion) {
    setSelectedQuestion(wrongQ);
    setPracticeAnswer('');
    setPracticeResult(null);
    setVariations([]);
    setActiveTab('practice');
  }

  async function submitPractice() {
    if (!selectedQuestion || !practiceAnswer || !token) return;
    try {
      const result = await recordPractice(token, selectedQuestion.id, practiceAnswer);
      setPracticeResult(result.isCorrect);
      loadData();
    } catch (e) {
      console.error('Practice failed:', e);
    }
  }

  async function handleGenerateVariation() {
    if (!selectedQuestion || !token) return;
    try {
      const v = await generateVariation(token, selectedQuestion.id);
      setVariations([...variations, v]);
    } catch (e) {
      console.error('Generate variation failed:', e);
    }
  }

  async function handleUpdateStatus(id: number, status: string) {
    if (!token) return;
    try {
      await updateReviewStatus(token, id, status);
      loadData();
    } catch (e) {
      console.error('Update status failed:', e);
    }
  }

  async function handleSaveNotes(id: number) {
    if (!token) return;
    try {
      await updateReviewStatus(token, id, undefined as any, notes);
      setShowNotes(null);
      setNotes('');
      loadData();
    } catch (e) {
      console.error('Save notes failed:', e);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'not_reviewed': return <span className="status-badge not-reviewed">未复习</span>;
      case 'reviewing': return <span className="status-badge reviewing">复习中</span>;
      case 'mastered': return <span className="status-badge mastered">已掌握</span>;
      default: return <span className="status-badge">{status}</span>;
    }
  }

  function getDifficultyBadge(difficulty: string) {
    const colors: Record<string, string> = {
      easy: '#4caf50', medium: '#ff9800', hard: '#f44336', very_hard: '#9c27b0',
    };
    const labels: Record<string, string> = {
      easy: '简单', medium: '中等', hard: '较难', very_hard: '困难',
    };
    return <span className="difficulty-badge" style={{ backgroundColor: colors[difficulty] || '#999' }}>
      {labels[difficulty] || difficulty}
    </span>;
  }

  return (
    <div className="wrong-question-book">
      <h1>错题本</h1>
      
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">总错题数</div>
          </div>
          <div className="stat-card not-reviewed">
            <div className="stat-number">{stats.notReviewed}</div>
            <div className="stat-label">未复习</div>
          </div>
          <div className="stat-card reviewing">
            <div className="stat-number">{stats.reviewing}</div>
            <div className="stat-label">复习中</div>
          </div>
          <div className="stat-card mastered">
            <div className="stat-number">{stats.mastered}</div>
            <div className="stat-label">已掌握</div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={activeTab === 'list' ? 'active' : ''} onClick={() => setActiveTab('list')}>
          错题列表
        </button>
        <button className={activeTab === 'practice' ? 'active' : ''} onClick={() => setActiveTab('practice')}>
          重练模式
        </button>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          统计分析
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="tab-content">
          <div className="filters">
            <select value={filters.reviewStatus} onChange={e => setFilters({...filters, reviewStatus: e.target.value})}>
              <option value="">全部状态</option>
              <option value="not_reviewed">未复习</option>
              <option value="reviewing">复习中</option>
              <option value="mastered">已掌握</option>
            </select>
            <select value={filters.questionType} onChange={e => setFilters({...filters, questionType: e.target.value})}>
              <option value="">全部题型</option>
              <option value="choice">选择题</option>
              <option value="fill">填空题</option>
              <option value="essay">解答题</option>
            </select>
            <select value={filters.difficulty} onChange={e => setFilters({...filters, difficulty: e.target.value})}>
              <option value="">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">较难</option>
              <option value="very_hard">困难</option>
            </select>
          </div>

          <div className="question-list">
            {loading ? (
              <div className="loading">加载中...</div>
            ) : questions.length === 0 ? (
              <div className="empty">暂无错题记录</div>
            ) : (
              questions.map(q => (
                <div key={q.id} className="question-card">
                  <div className="question-header">
                    <span className="question-id">#{q.questionId}</span>
                    {getStatusBadge(q.reviewStatus)}
                    {q.question?.difficulty && getDifficultyBadge(q.question.difficulty)}
                    <span className="wrong-count">错误 {q.wrongCount} 次</span>
                  </div>
                  <div className="question-content">
                    {q.question?.content || '题目内容加载中...'}
                  </div>
                  <div className="question-meta">
                    <span>正确答案: {q.correctAnswer}</span>
                    {q.originalAnswer && <span>你的答案: {q.originalAnswer}</span>}
                  </div>
                  {q.tags && (
                    <div className="question-tags">
                      {q.tags.split(',').map((tag, i) => (
                        <span key={i} className="tag">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="question-actions">
                    <button onClick={() => handlePractice(q)} className="btn-practice">
                      重练
                    </button>
                    {q.reviewStatus !== 'mastered' && (
                      <button onClick={() => handleUpdateStatus(q.id, 'mastered')} className="btn-mastered">
                        标记已掌握
                      </button>
                    )}
                    <button onClick={() => { setShowNotes(q.id); setNotes(q.notes || ''); }} className="btn-notes">
                      笔记
                    </button>
                  </div>
                  {showNotes === q.id && (
                    <div className="notes-modal">
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="添加笔记..." />
                      <div className="notes-actions">
                        <button onClick={() => handleSaveNotes(q.id)}>保存</button>
                        <button onClick={() => setShowNotes(null)}>取消</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'practice' && (
        <div className="tab-content practice-tab">
          {!selectedQuestion ? (
            <div className="empty">请从错题列表中选择一道题目进行重练</div>
          ) : (
            <div className="practice-container">
              <div className="practice-question">
                <h3>原题</h3>
                <p>{selectedQuestion.question?.content || '题目内容加载中...'}</p>
                {selectedQuestion.question?.options && (() => {
                  try {
                    const opts = JSON.parse(selectedQuestion.question.options);
                    return (
                      <div className="options">
                        {Object.entries(opts).map(([key, value]) => (
                          <div key={key} className="option">{key}. {value as string}</div>
                        ))}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
              
              <div className="practice-answer">
                <h3>你的答案</h3>
                {selectedQuestion.question?.questionType === 'choice' ? (
                  <div className="choice-options">
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <button
                        key={opt}
                        className={practiceAnswer === opt ? 'selected' : ''}
                        onClick={() => setPracticeAnswer(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={practiceAnswer}
                    onChange={e => setPracticeAnswer(e.target.value)}
                    placeholder="请输入答案..."
                    rows={4}
                  />
                )}
                <button onClick={submitPractice} className="btn-submit">提交答案</button>
              </div>

              {practiceResult !== null && (
                <div className={`practice-result ${practiceResult ? 'correct' : 'wrong'}`}>
                  {practiceResult ? '✓ 回答正确！' : '✗ 回答错误'}
                  {!practiceResult && (
                    <div className="correct-answer">正确答案: {selectedQuestion.correctAnswer}</div>
                  )}
                </div>
              )}

              <div className="variations-section">
                <h3>变式训练</h3>
                <button onClick={handleGenerateVariation} className="btn-generate">
                  生成变式题
                </button>
                {variations.map((v, i) => (
                  <div key={i} className="variation-card">
                    <p>{v.content}</p>
                    <div className="variation-meta">
                      <span className="difficulty-badge">{v.difficulty}</span>
                      <span>AI生成</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="tab-content stats-tab">
          <div className="stats-section">
            <h3>按题型分布</h3>
            <div className="stats-bar">
              {stats.byType.map(t => (
                <div key={t.type} className="bar-item">
                  <span className="bar-label">{t.type === 'choice' ? '选择题' : t.type === 'fill' ? '填空题' : '解答题'}</span>
                  <div className="bar-fill" style={{ width: `${(t.count / stats.total) * 100}%` }}>
                    {t.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-section">
            <h3>按难度分布</h3>
            <div className="stats-bar">
              {stats.byDifficulty.map(d => (
                <div key={d.difficulty} className="bar-item">
                  <span className="bar-label">{d.difficulty === 'easy' ? '简单' : d.difficulty === 'medium' ? '中等' : d.difficulty === 'hard' ? '较难' : '困难'}</span>
                  <div className="bar-fill" style={{ width: `${(d.count / stats.total) * 100}%`, backgroundColor: d.difficulty === 'easy' ? '#4caf50' : d.difficulty === 'medium' ? '#ff9800' : d.difficulty === 'hard' ? '#f44336' : '#9c27b0' }}>
                    {d.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}