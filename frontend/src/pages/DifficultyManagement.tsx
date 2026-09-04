import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MathText from '../components/MathText';
import {
  getDifficultyStats,
  assessDifficulty,
  batchAssessDifficulty,
  adjustDifficulty,
  getAdjustmentHistory,
} from '../services/difficulty-api';
import { getAllQuestions } from '../services/papers-api';
import './DifficultyManagement.css';

interface Question {
  id: number;
  content: string;
  questionType: string;
  difficulty?: string | null;
  paperId: number;
}

interface DifficultyStats {
  easy: number;
  medium: number;
  hard: number;
  very_hard: number;
  total: number;
}

interface Adjustment {
  id: number;
  questionId: number;
  oldDifficulty: string | null;
  newDifficulty: string;
  reason: string | null;
  createdAt: string;
}

export default function DifficultyManagement() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<DifficultyStats | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'assess' | 'history'>('stats');
  const [adjustHistory, setAdjustHistory] = useState<Adjustment[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustQuestion, setAdjustQuestion] = useState<Question | null>(null);
  const [adjustDifficultyValue, setAdjustDifficultyValue] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    if (token && user?.role === 'admin') {
      loadStats();
      loadQuestions();
    }
  }, [token, user]);

  useEffect(() => {
    if (activeTab === 'history' && token && questions.length > 0) {
      // Load adjustment history for the first question as example
      loadAllHistory();
    }
  }, [activeTab, token, questions]);

  const loadAllHistory = async () => {
    if (!token) return;
    try {
      // For simplicity, load history for all questions
      const allHistory: Adjustment[] = [];
      for (const q of questions.slice(0, 10)) { // Limit to first 10 to avoid too many requests
        const history = await getAdjustmentHistory(q.id, token);
        allHistory.push(...history);
      }
      setAdjustHistory(allHistory);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const loadStats = async () => {
    if (!token) return;
    try {
      const statsData = await getDifficultyStats(token);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const loadQuestions = async () => {
    if (!token) return;
    try {
      const data = await getAllQuestions(token);
      setQuestions(data);
    } catch (e) {
      console.error('Failed to load questions:', e);
    }
  };

  const handleAssess = async (questionId: number) => {
    if (!token) return;
    setLoading(true);
    try {
      await assessDifficulty(questionId, token);
      await Promise.all([loadStats(), loadQuestions()]);
    } catch (e) {
      console.error('Assessment failed:', e);
    }
    setLoading(false);
  };

  const handleBatchAssess = async () => {
    if (!token || selectedQuestions.length === 0) return;
    setLoading(true);
    try {
      await batchAssessDifficulty(selectedQuestions, token);
      await Promise.all([loadStats(), loadQuestions()]);
      setSelectedQuestions([]);
    } catch (e) {
      console.error('Batch assessment failed:', e);
    }
    setLoading(false);
  };

  const handleAdjust = async () => {
    if (!token || !adjustQuestion || !adjustDifficultyValue) return;
    setLoading(true);
    try {
      await adjustDifficulty(adjustQuestion.id, adjustDifficultyValue, adjustReason, token);
      await Promise.all([loadStats(), loadQuestions()]);
      setShowAdjustModal(false);
      setAdjustQuestion(null);
      setAdjustDifficultyValue('');
      setAdjustReason('');
    } catch (e) {
      console.error('Adjustment failed:', e);
    }
    setLoading(false);
  };

  const openAdjustModal = (question: Question) => {
    setAdjustQuestion(question);
    setAdjustDifficultyValue(question.difficulty || 'medium');
    setAdjustReason('');
    setShowAdjustModal(true);
};

if (user?.role !== 'admin') {
    return (
      <div className="error-container">
        <h2>权限不足</h2>
        <p>仅管理员可访问此页面</p>
      </div>
    );
  }

  const difficultyColors: Record<string, string> = {
    easy: 'difficulty-easy',
    medium: 'difficulty-medium',
    hard: 'difficulty-hard',
    very_hard: 'difficulty-very-hard',
  };

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '较难',
    very_hard: '困难',
    null: '未评估',
  };

  return (
    <div className="difficulty-management">
      <h1>难度管理</h1>

      <div className="tabs">
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          统计概览
        </button>
        <button
          className={activeTab === 'assess' ? 'active' : ''}
          onClick={() => setActiveTab('assess')}
        >
          难度评估
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          调整历史
        </button>
      </div>

      {activeTab === 'stats' && stats && (
        <div className="stats-section">
          <h2>整体难度分布</h2>
          <div className="stats-grid">
            <div className={`stat-card ${difficultyColors.easy}`}>
              <h3>简单</h3>
              <p className="stat-number">{stats.easy}</p>
            </div>
            <div className={`stat-card ${difficultyColors.medium}`}>
              <h3>中等</h3>
              <p className="stat-number">{stats.medium}</p>
            </div>
            <div className={`stat-card ${difficultyColors.hard}`}>
              <h3>较难</h3>
              <p className="stat-number">{stats.hard}</p>
            </div>
            <div className={`stat-card ${difficultyColors.very_hard}`}>
              <h3>困难</h3>
              <p className="stat-number">{stats.very_hard}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assess' && (
        <div className="assess-section">
          <div className="assess-actions">
            <button
              onClick={handleBatchAssess}
              disabled={selectedQuestions.length === 0 || loading}
              className="btn-primary"
            >
              {loading ? '评估中...' : `批量评估 (${selectedQuestions.length})`}
            </button>
          </div>

          <div className="questions-list">
            {questions.map((q) => (
              <div key={q.id} className="question-item">
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedQuestions([...selectedQuestions, q.id]);
                    } else {
                      setSelectedQuestions(selectedQuestions.filter((id) => id !== q.id));
                    }
                  }}
                />
                <div className="question-content">
                  <p><MathText text={q.content.substring(0, 100)} />...</p>
                  <div className="question-meta">
                    <span className={`difficulty-badge ${difficultyColors[q.difficulty || 'null']}`}>
                      {difficultyLabels[q.difficulty || 'null']}
                    </span>
                    <span className="question-type">{q.questionType}</span>
                  </div>
                </div>
                <div className="question-actions">
                  <button onClick={() => handleAssess(q.id)} disabled={loading}>
                    AI评估
                  </button>
                  <button onClick={() => openAdjustModal(q)}>手动调整</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>调整历史</h2>
          {adjustHistory.length === 0 ? (
            <p>暂无调整历史</p>
          ) : (
            <div className="history-list">
              {adjustHistory.map((adj) => (
                <div key={adj.id} className="history-item">
                  <div className="history-header">
                    <span>题目 #{adj.questionId}</span>
                    <span>{new Date(adj.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="history-change">
                    <span className="old-diff">{difficultyLabels[adj.oldDifficulty || 'null']}</span>
                    <span>→</span>
                    <span className="new-diff">{difficultyLabels[adj.newDifficulty]}</span>
                  </div>
                  {adj.reason && <p className="history-reason">原因: {adj.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdjustModal && adjustQuestion && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>调整难度</h2>
            <p className="modal-question">{adjustQuestion.content.substring(0, 150)}...</p>
            
            <div className="form-group">
              <label>难度等级</label>
              <select
                value={adjustDifficultyValue}
                onChange={(e) => setAdjustDifficultyValue(e.target.value)}
              >
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">较难</option>
                <option value="very_hard">困难</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>调整原因</label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="请输入调整原因..."
              />
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowAdjustModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleAdjust} disabled={loading} className="btn-primary">
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}