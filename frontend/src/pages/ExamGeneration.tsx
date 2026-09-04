import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateExam, previewExam, getExams, getTemplates } from '../services/exams-api';
import MathText from '../components/MathText';
import './ExamGeneration.css';

interface QuestionParams {
  choice: number;
  fill: number;
  essay: number;
}

interface DifficultyParams {
  easy: number;
  medium: number;
  hard: number;
  very_hard: number;
}

export default function ExamGeneration() {
  const { user, token } = useAuth();
  const [title, setTitle] = useState('');
  const [questionTypes, setQuestionTypes] = useState<QuestionParams>({
    choice: 10,
    fill: 5,
    essay: 3,
  });
  const [difficulty, setDifficulty] = useState<DifficultyParams>({
    easy: 30,
    medium: 40,
    hard: 20,
    very_hard: 10,
  });
  const [totalScore, setTotalScore] = useState(150);
  const [preview, setPreview] = useState<any>(null);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'templates'>('generate');

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await previewExam(token!, {
        name: title || `数学试卷 ${new Date().toLocaleDateString()}`,
        questionTypes,
        difficultyDistribution: difficulty,
        totalScore,
      });
      setPreview(result);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await generateExam(token!, {
        name: title || `数学试卷 ${new Date().toLocaleDateString()}`,
        questionTypes,
        difficultyDistribution: difficulty,
        totalScore,
      });
      setGeneratedExam(result);
      setPreview(null);
      alert(`试卷生成成功！ID: ${result.id}`);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [examsData, templatesData] = await Promise.all([
        getExams(token!),
        getTemplates(token!),
      ]);
      setExams(examsData);
      setTemplates(templatesData);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (activeTab === 'history' || activeTab === 'templates') {
      loadHistory();
    }
  }, [activeTab]);

  const questionTypeLabels: Record<string, string> = {
    choice: '选择题',
    fill: '填空题',
    essay: '解答题',
  };

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    very_hard: '极难',
  };

  const difficultyColors: Record<string, string> = {
    easy: '#22c55e',
    medium: '#eab308',
    hard: '#f97316',
    very_hard: '#dc2626',
  };

  if (user?.role !== 'admin') {
    return (
      <div className="error-container">
        <h2>权限不足</h2>
        <p>仅管理员可以生成试卷</p>
      </div>
    );
  }

  return (
    <div className="exam-generation">
      <h1>自动出卷</h1>

      <div className="tabs">
        <button 
          className={activeTab === 'generate' ? 'active' : ''} 
          onClick={() => setActiveTab('generate')}
        >
          生成试卷
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          历史试卷
        </button>
        <button 
          className={activeTab === 'templates' ? 'active' : ''} 
          onClick={() => setActiveTab('templates')}
        >
          模板管理
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeTab === 'generate' && (
        <div className="generate-section">
          <div className="form-section">
            <h2>试卷参数</h2>

            <div className="form-group">
              <label>试卷标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="留空则自动生成"
              />
            </div>

            <div className="form-group">
              <label>总分</label>
              <input
                type="number"
                value={totalScore}
                onChange={(e) => setTotalScore(parseInt(e.target.value) || 0)}
              />
            </div>

            <h3>题型分布</h3>
            <div className="input-grid">
              {Object.entries(questionTypes).map(([type, count]) => (
                <div key={type} className="input-item">
                  <label>{questionTypeLabels[type]}</label>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setQuestionTypes({
                      ...questionTypes,
                      [type]: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
              ))}
            </div>

            <h3>难度分布 (%)</h3>
            <div className="input-grid">
              {Object.entries(difficulty).map(([level, percent]) => (
                <div key={level} className="input-item">
                  <label style={{ color: difficultyColors[level] }}>
                    {difficultyLabels[level]}
                  </label>
                  <input
                    type="number"
                    value={percent}
                    onChange={(e) => setDifficulty({
                      ...difficulty,
                      [level]: parseInt(e.target.value) || 0,
                    })}
                  />
                </div>
              ))}
            </div>

            <div className="button-group">
              <button onClick={handlePreview} disabled={loading} className="btn-secondary">
                预览题目
              </button>
              <button onClick={handleGenerate} disabled={loading} className="btn-primary">
                生成试卷
              </button>
            </div>
          </div>

          {preview && (
            <div className="preview-section">
              <h2>题目预览</h2>
              <div className="stats">
                <span>题目数: {preview.questions?.length || 0}</span>
                <span>总分: {preview.totalScore}</span>
              </div>
              <div className="question-list">
                {preview.questions?.map((q: any, i: number) => (
                  <div key={i} className="question-card">
                    <div className="question-header">
                      <span className="number">第{i + 1}题</span>
                      <span className="type">{questionTypeLabels[q.questionType]}</span>
                      <span 
                        className="difficulty"
                        style={{ backgroundColor: difficultyColors[q.difficulty] }}
                      >
                        {difficultyLabels[q.difficulty]}
                      </span>
                      <span className="score">{q.score}分</span>
                    </div>
                    <div className="content"><MathText text={q.content} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generatedExam && (
            <div className="result-section">
              <h2>生成结果</h2>
              <p>试卷ID: {generatedExam.id}</p>
              <p>标题: {generatedExam.title}</p>
              <p>总分: {generatedExam.totalScore}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>历史试卷</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>总分</th>
                <th>题目数</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {exams.map(exam => (
                <tr key={exam.id}>
                  <td>{exam.id}</td>
                  <td>{exam.title}</td>
                  <td>{exam.totalScore}</td>
                  <td>{exam.questions?.length || 0}</td>
                  <td>{new Date(exam.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="templates-section">
          <h2>出卷模板</h2>
          {templates.length === 0 ? (
            <p>暂无模板</p>
          ) : (
            <div className="template-list">
              {templates.map(template => (
                <div key={template.id} className="template-card">
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <div className="template-config">
                    选择题: {template.config.questionTypes.choice} |
                    填空题: {template.config.questionTypes.fill} |
                    解答题: {template.config.questionTypes.essay}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}