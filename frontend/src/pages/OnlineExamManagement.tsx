import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createExam,
  publishExam,
  getExams,
} from '../services/online-exams-api';
import MathText from '../components/MathText';
import type { OnlineExam, ExamQuestion } from '../services/online-exams-api';
import { getAllQuestions } from '../services/papers-api';
import './OnlineExamManagement.css';

export default function OnlineExamManagement() {
  const { user, token } = useAuth();
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Create exam form
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [questionFilter, setQuestionFilter] = useState<'all' | 'choice' | 'fill' | 'essay'>('all');

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    const [examsData, questionsData] = await Promise.all([getExams(token), getAllQuestions(token)]);
    setExams(examsData);
    // @ts-ignore
    setQuestions(questionsData || []);
    setLoading(false);
  };

  const handleCreateExam = async () => {
    if (!token) return;
    if (!title || selectedQuestions.length === 0) {
      alert('请填写试卷标题并选择题目');
      return;
    }

    const totalScore = questions
      .filter((q) => selectedQuestions.includes(q.id))
      .reduce((sum, q) => sum + q.score, 0);

    const result = await createExam({
      title,
      questionIds: selectedQuestions,
      totalScore,
      duration,
    }, token);

    if (result.exam) {
      alert('测验创建成功');
      setTitle('');
      setSelectedQuestions([]);
      loadData();
      setActiveTab('list');
    } else {
      alert(result.error || '创建失败');
    }
  };

  const handlePublishExam = async (examId: number) => {
    if (!token) return;
    const result = await publishExam(examId, {}, token);
    if (result.exam) {
      alert('测验已发布');
      loadData();
    } else {
      alert(result.error || '发布失败');
    }
  };

  const toggleQuestion = (questionId: number) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };

  const filteredQuestions = questions.filter((q) => {
    if (questionFilter === 'all') return true;
    return q.questionType === questionFilter;
  });

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      choice: '选择题',
      fill: '填空题',
      essay: '解答题',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      ongoing: '进行中',
      ended: '已结束',
    };
    return labels[status] || status;
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
    <div className="online-exam-management">
      <h1>在线测验管理</h1>

      <div className="tabs">
        <button
          className={activeTab === 'list' ? 'active' : ''}
          onClick={() => setActiveTab('list')}
        >
          测验列表
        </button>
        <button
          className={activeTab === 'create' ? 'active' : ''}
          onClick={() => setActiveTab('create')}
        >
          创建测验
        </button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : activeTab === 'list' ? (
        <div className="exam-list">
          {exams.length === 0 ? (
            <p>暂无测验</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>标题</th>
                  <th>题目数</th>
                  <th>总分</th>
                  <th>时长(分钟)</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td>{exam.title}</td>
                    <td>{exam.questionIds.length}</td>
                    <td>{exam.totalScore}</td>
                    <td>{exam.duration}</td>
                    <td>
                      <span className={`status-badge ${exam.status}`}>{getStatusLabel(exam.status)}</span>
                    </td>
                    <td>
                      {exam.status === 'draft' && (
                        <button onClick={() => handlePublishExam(exam.id)} className="btn-publish">
                          发布
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="create-exam">
          <div className="form-section">
            <h2>测验信息</h2>
            <div className="form-group">
              <label>标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入测验标题"
              />
            </div>
            <div className="form-group">
              <label>时长(分钟)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                min="1"
              />
            </div>
          </div>

          <div className="question-selection">
            <h2>选择题目</h2>
            <div className="filter-bar">
              <label>题型筛选:</label>
              <select value={questionFilter} onChange={(e) => setQuestionFilter(e.target.value as any)}>
                <option value="all">全部</option>
                <option value="choice">选择题</option>
                <option value="fill">填空题</option>
                <option value="essay">解答题</option>
              </select>
              <span className="selected-count">已选: {selectedQuestions.length} 题</span>
            </div>

            <div className="question-grid">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className={`question-card ${selectedQuestions.includes(q.id) ? 'selected' : ''}`}
                  onClick={() => toggleQuestion(q.id)}
                >
                  <div className="question-header">
                    <span className={`type-badge ${q.questionType}`}>{getQuestionTypeLabel(q.questionType)}</span>
                    <span className="score">{q.score}分</span>
                  </div>
                  <div className="question-content"><MathText text={q.content.substring(0, 100)} />...</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleCreateExam} className="btn-create">
            创建测验
          </button>
        </div>
      )}
    </div>
  );
}