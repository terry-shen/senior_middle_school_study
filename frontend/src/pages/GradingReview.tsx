import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getGradingStats,
  batchGradeExamRecord,
  adjustGrade,
} from '../services/grading-api';
import type { GradingStats, GradingResult } from '../services/grading-api';
import './GradingReview.css';

export default function GradingReview() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<GradingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [examRecordId, setExamRecordId] = useState('');
  const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
  const [adjustingRecord, setAdjustingRecord] = useState<number | null>(null);
  const [adjustScore, setAdjustScore] = useState('');
  const [adjustFeedback, setAdjustFeedback] = useState('');

  useEffect(() => {
    if (token) {
      loadStats();
    }
  }, [token]);

  const loadStats = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getGradingStats(token);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
    setLoading(false);
  };

  const handleBatchGrade = async () => {
    if (!token || !examRecordId) return;
    setLoading(true);
    try {
      const result = await batchGradeExamRecord(parseInt(examRecordId), token);
      if (result.success) {
        setGradingResults(result.results);
        loadStats();
      }
    } catch (error) {
      console.error('Batch grading failed:', error);
    }
    setLoading(false);
  };

  const handleAdjustGrade = async (recordId: number) => {
    if (!token || !adjustScore || !adjustFeedback) return;
    try {
      await adjustGrade(recordId, parseFloat(adjustScore), adjustFeedback, token);
      setAdjustingRecord(null);
      setAdjustScore('');
      setAdjustFeedback('');
      loadStats();
    } catch (error) {
      console.error('Adjust grade failed:', error);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="error-container">
        <h2>权限不足</h2>
        <p>您没有权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="grading-review-container">
      <h1>AI批改管理</h1>

      {/* Statistics */}
      {loading && !stats ? (
        <div className="loading">加载中...</div>
      ) : stats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>总答题数</h3>
            <div className="stat-value">{stats.totalRecords}</div>
          </div>
          <div className="stat-card">
            <h3>已批改</h3>
            <div className="stat-value">{stats.gradedRecords}</div>
          </div>
          <div className="stat-card pending">
            <h3>待批改</h3>
            <div className="stat-value">{stats.pendingRecords}</div>
          </div>
          <div className="stat-card">
            <h3>平均分</h3>
            <div className="stat-value">{(stats.averageScore ?? 0).toFixed(1)}</div>
          </div>
        </div>
      ) : null}

      {/* Batch Grading */}
      <div className="batch-grading-section">
        <h2>批量批改</h2>
        <div className="batch-form">
          <input
            type="number"
            placeholder="输入考试记录ID"
            value={examRecordId}
            onChange={(e) => setExamRecordId(e.target.value)}
          />
          <button onClick={handleBatchGrade} disabled={loading || !examRecordId}>
            {loading ? '批改中...' : '批量批改'}
          </button>
        </div>

        {/* Grading Results */}
        {gradingResults.length > 0 && (
          <div className="grading-results">
            <h3>批改结果</h3>
            <table>
              <thead>
                <tr>
                  <th>题目ID</th>
                  <th>得分</th>
                  <th>满分</th>
                  <th>反馈</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {gradingResults.map((result) => (
                  <tr key={result.recordId}>
                    <td>{result.questionId}</td>
                    <td className={result.score === result.maxScore ? 'full-score' : ''}>
                      {result.score}
                    </td>
                    <td>{result.maxScore}</td>
                    <td>{result.feedback || '-'}</td>
                    <td>
                      {adjustingRecord === result.recordId ? (
                        <div className="adjust-form">
                          <input
                            type="number"
                            placeholder="调整后分数"
                            value={adjustScore}
                            onChange={(e) => setAdjustScore(e.target.value)}
                            max={result.maxScore}
                            min={0}
                          />
                          <input
                            type="text"
                            placeholder="调整原因"
                            value={adjustFeedback}
                            onChange={(e) => setAdjustFeedback(e.target.value)}
                          />
                          <button onClick={() => handleAdjustGrade(result.recordId)}>
                            确认
                          </button>
                          <button onClick={() => setAdjustingRecord(null)}>取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setAdjustingRecord(result.recordId)}>
                          调整分数
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Question Type */}
      {stats && stats.byQuestionType.length > 0 && (
        <div className="question-type-stats">
          <h2>按题型统计</h2>
          <table>
            <thead>
              <tr>
                <th>题型</th>
                <th>总数</th>
                <th>已批改</th>
                <th>批改率</th>
                <th>平均分</th>
              </tr>
            </thead>
            <tbody>
              {stats.byQuestionType.map((type) => (
                <tr key={type.type}>
                  <td>
                    {type.type === 'single_choice'
                      ? '单选题'
                      : type.type === 'multiple_choice'
                      ? '多选题'
                      : type.type === 'choice'
                      ? '选择题'
                      : type.type === 'fill'
                      ? '填空题'
                      : '解答题'}
                  </td>
                  <td>{type.total}</td>
                  <td>{type.graded}</td>
                  <td>
                    {type.total > 0
                      ? ((type.graded / type.total) * 100).toFixed(1) + '%'
                      : '0%'}
                  </td>
                  <td>{(type.averageScore ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}