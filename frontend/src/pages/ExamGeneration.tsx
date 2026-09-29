import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateExam, previewExam, getExams, getTemplates } from '../services/exams-api';
import { getPapers } from '../services/papers-api';
import MathText from '../components/MathText';
import './ExamGeneration.css';

interface QuestionParams {
  single_choice: number;
  multiple_choice: number;
  fill: number;
  essay: number;
  [key: string]: number;
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
    single_choice: 8,
    multiple_choice: 2,
    fill: 4,
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
  const [papers, setPapers] = useState<any[]>([]);
  const [sourcePaperId, setSourcePaperId] = useState<number>(0);

  // 加载导入的试卷列表（供"指定试卷独立出卷"）
  React.useEffect(() => {
    if (token) {
      getPapers(token)
        .then((data: any) => {
          const list = Array.isArray(data) ? data : (data.data || []);
          setPapers(list);
        })
        .catch(() => {});
    }
  }, [token]);

  // 构造出卷参数：难度百分比(0-100) → 比例(0-1)
  const buildParams = () => ({
    name: title || `数学试卷 ${new Date().toLocaleDateString()}`,
    paperId: sourcePaperId > 0 ? sourcePaperId : undefined,
    typeDistribution: questionTypes,
    difficultyDistribution: {
      easy: difficulty.easy / 100,
      medium: difficulty.medium / 100,
      hard: difficulty.hard / 100,
      very_hard: difficulty.very_hard / 100,
    },
    scoreDistribution: { single_choice: 5, multiple_choice: 5, fill: 10, essay: 15 },
    totalScore,
    duration: 90,
  });

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await previewExam(token!, buildParams());
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
      const result = await generateExam(token!, buildParams());
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
    single_choice: '单选题',
    multiple_choice: '多选题',
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

  // 历史试卷的 questions 字段是 JSON 字符串，解析取题目数
  const getQuestionCount = (q: any): number => {
    if (!q) return 0;
    if (typeof q === 'string') {
      try { return JSON.parse(q).length; } catch { return 0; }
    }
    return Array.isArray(q) ? q.length : 0;
  };

  // 解析模板的 JSON 字符串字段
  const parseJsonField = (s: string | undefined): any => {
    try { return JSON.parse(s || '{}'); } catch { return {}; }
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
              <label>出卷来源</label>
              <select
                value={sourcePaperId}
                onChange={(e) => setSourcePaperId(parseInt(e.target.value) || 0)}
              >
                <option value="0">全部题目（自由随机组卷）</option>
                {papers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title || `试卷 ${p.id}`}
                    {(p as any)._count?.questions != null ? `（${(p as any)._count.questions}题）` : ''}
                  </option>
                ))}
              </select>
              <span className="form-hint">选择指定试卷后，仅从该试卷中抽取题目独立出卷</span>
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
                      <span className="type">{questionTypeLabels[q.questionType] || '未分类'}</span>
                      <span
                        className="difficulty"
                        style={{ backgroundColor: difficultyColors[q.difficulty || 'medium'] }}
                      >
                        {difficultyLabels[q.difficulty || 'medium']}
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
                    <td>{getQuestionCount(exam.questions)}</td>
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
              {templates.map(template => {
                const typeDist = parseJsonField(template.typeDistribution);
                const diffDist = parseJsonField(template.difficultyDistribution);
                return (
                  <div key={template.id} className="template-card">
                    <h3>{template.name}</h3>
                    <div className="template-config">
                      单选题: {typeDist.single_choice || 0} |
                      多选题: {typeDist.multiple_choice || 0} |
                      填空题: {typeDist.fill || 0} |
                      解答题: {typeDist.essay || 0}
                      {template.questionCount ? ` | 共${template.questionCount}题` : ''}
                      {template.totalScore ? ` | 总分${template.totalScore}` : ''}
                    </div>
                    <div className="template-config">
                      难度: 简单{Math.round((diffDist.easy || 0.3) * 100)}% / 中等{Math.round((diffDist.medium || 0.5) * 100)}% / 困难{Math.round((diffDist.hard || 0.2) * 100)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}