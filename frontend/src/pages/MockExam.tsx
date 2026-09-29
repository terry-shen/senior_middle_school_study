import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MathText from '../components/MathText';
import AnswerSheetUpload from '../components/AnswerSheetUpload';
import { downloadWholePaperFile, triggerBlobDownload } from '../services/papers-api';
import {
  getMockExams,
  getMockExamHistory,
  createMockExam,
  publishMockExam,
  deleteMockExam,
  startMockExam,
  saveMockAnswer,
  toggleMark,
  submitMockExam,
  getMockExamResult,
  getBenchmarkAnalysis,
  getWrongQuestionAnalysis,
  type MockExam,
  type MockExamResult,
  type BenchmarkAnalysis,
  type WrongQuestionAnalysis,
} from '../services/mock-exams-api';
import './MockExam.css';

type View = 'list' | 'taking' | 'result' | 'benchmark' | 'wrong-analysis' | 'answer-sheet';

/** 整卷模式：关联原始试卷（questionIds 为空） */
function isWholePaperExam(exam: MockExam): boolean {
  let ids: number[] = [];
  try { ids = JSON.parse(exam.questionIds || '[]'); } catch { ids = []; }
  return ids.length === 0 && !!exam.paper;
}

export default function MockExamPage() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState<View>('list');
  const [exams, setExams] = useState<MockExam[]>([]);
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [result, setResult] = useState<MockExamResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkAnalysis | null>(null);
  const [wrongAnalysis, setWrongAnalysis] = useState<WrongQuestionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadExams = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = isAdmin ? await getMockExams(token) : await getMockExamHistory(token);
      setExams(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (user) loadExams();
  }, [user, loadExams]);

  // Admin: Create mock exam
  const handleCreate = async (formData: { title: string; standard: string; duration: number; totalScore: number }) => {
    if (!token) return;
    try {
      await createMockExam(token, {
        title: formData.title,
        standard: formData.standard,
        duration: formData.duration,
        totalScore: formData.totalScore,
      });
      setShowCreate(false);
      loadExams();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Admin: Publish
  const handlePublish = async (id: number) => {
    if (!token) return;
    try {
      await publishMockExam(token, id);
      loadExams();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Admin: Delete
  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm('确定删除此模拟考试?')) return;
    try {
      await deleteMockExam(token, id);
      loadExams();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Student: Start exam
  const handleStart = async (id: number) => {
    if (!token) return;
    try {
      await startMockExam(token, id);
      setCurrentExamId(id);
      setView('taking');
    } catch (e: any) {
      setError(e.message);
    }
  };

  /** Student: download the whole paper (整卷模式) */
  const handleDownloadPaper = async (exam: MockExam) => {
    if (!token || !exam.paper) return;
    try {
      const ext = (exam.paper.pdfUrl?.split('.').pop() || 'doc').toLowerCase();
      const { blob, filename } = await downloadWholePaperFile(token, exam.paper.id, `${exam.title}.${ext}`);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      setError(e.message || '试卷下载失败');
    }
  };

  // Student: View result
  const handleViewResult = async (id: number) => {
    if (!token) return;
    try {
      const r = await getMockExamResult(token, id);
      setResult(r);
      setCurrentExamId(id);
      setView('result');
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Student: View benchmark
  const handleViewBenchmark = async (id: number) => {
    if (!token) return;
    try {
      const b = await getBenchmarkAnalysis(token, id);
      setBenchmark(b);
      setCurrentExamId(id);
      setView('benchmark');
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Student: View wrong analysis
  const handleViewWrong = async (id: number) => {
    if (!token) return;
    try {
      const w = await getWrongQuestionAnalysis(token, id);
      setWrongAnalysis(w);
      setCurrentExamId(id);
      setView('wrong-analysis');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'gray',
      published: 'blue',
      in_progress: 'orange',
      completed: 'green',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      in_progress: '进行中',
      completed: '已完成',
    };
    return <span className={`badge ${colors[status] || 'gray'}`}>{labels[status] || status}</span>;
  };

  if (loading) return <div className="mock-exam-page"><p>加载中...</p></div>;

  return (
    <div className="mock-exam-page">
      <h1>模拟考试</h1>
      {error && <div className="error-msg">{error}</div>}

      {view === 'list' && (
        <>
          <div className="header-bar">
            {isAdmin && (
              <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? '取消' : '创建模拟考试'}
              </button>
            )}
            <button className="btn-secondary" onClick={loadExams}>刷新</button>
          </div>

          {showCreate && isAdmin && (
            <CreateMockExamForm onCreate={handleCreate} />
          )}

          {exams.length === 0 ? (
            <p className="empty">暂无模拟考试</p>
          ) : (
            <table className="exam-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>标准</th>
                  <th>满分</th>
                  <th>时长</th>
                  <th>状态</th>
                  <th>{isAdmin ? '操作' : '得分'}</th>
                  {!isAdmin && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => (
                  <tr key={exam.id}>
                    <td>{exam.title}</td>
                    <td>{exam.standard}</td>
                    <td>{exam.totalScore}</td>
                    <td>{exam.duration}分钟</td>
                    <td>{statusBadge(exam.status)}</td>
                    {isAdmin ? (
                      <td>
                        {exam.status === 'draft' && (
                          <button className="btn-small" onClick={() => handlePublish(exam.id)}>发布</button>
                        )}
                        <button className="btn-small btn-danger" onClick={() => handleDelete(exam.id)}>删除</button>
                      </td>
                    ) : (
                      <>
                        <td>{exam.studentScore !== undefined ? `${exam.studentScore}/${exam.totalScore}` : '-'}</td>
                        <td>
                          {exam.status === 'published' && (
                            isWholePaperExam(exam) ? (
                              <button className="btn-small" onClick={() => handleDownloadPaper(exam)}>下载试卷</button>
                            ) : (
                              <button className="btn-small" onClick={() => handleStart(exam.id)}>开始考试</button>
                            )
                          )}
                          {isWholePaperExam(exam) && exam.status === 'published' && (
                            <button className="btn-small" onClick={() => { setCurrentExamId(exam.id); setView('answer-sheet'); }}>上传答题纸</button>
                          )}
                          {exam.status === 'completed' && (
                            <>
                              <button className="btn-small" onClick={() => handleViewResult(exam.id)}>查看结果</button>
                              <button className="btn-small" onClick={() => handleViewBenchmark(exam.id)}>对标分析</button>
                              <button className="btn-small" onClick={() => handleViewWrong(exam.id)}>错题分析</button>
                            </>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {view === 'taking' && currentExamId && (
        <TakingExam
          examId={currentExamId}
          token={token!}
          onSubmit={async () => {
            try {
              await submitMockExam(token!, currentExamId);
              const r = await getMockExamResult(token!, currentExamId);
              setResult(r);
              setView('result');
            } catch (e: any) {
              setError(e.message);
            }
          }}
          onBack={() => { setView('list'); setCurrentExamId(null); }}
        />
      )}

      {view === 'answer-sheet' && currentExamId && token && (
        <div className="whole-paper-sheet-view">
          <div className="whole-paper-head">
            <h2>上传答题纸</h2>
            <button className="btn-small" onClick={() => setView('list')}>返回列表</button>
          </div>
          <p className="whole-paper-tip">
            本场为整卷考试：先「下载试卷」线下作答，然后把答题纸拍照或导出为 Word 上传，由老师离线批改。
          </p>
          <AnswerSheetUpload
            token={token}
            scene={{ mockExamId: currentExamId }}
            sceneLabel="模拟考试"
          />
        </div>
      )}

      {view === 'result' && result && (
        <>
          <ResultView result={result} onBack={() => { setView('list'); setResult(null); }} />
          {currentExamId && token && (
            <AnswerSheetUpload
              token={token}
              scene={{ mockExamId: currentExamId }}
              sceneLabel="模拟考试"
            />
          )}
        </>
      )}

      {view === 'benchmark' && benchmark && (
        <BenchmarkView benchmark={benchmark} onBack={() => { setView('list'); setBenchmark(null); }} />
      )}

      {view === 'wrong-analysis' && wrongAnalysis && (
        <WrongAnalysisView analysis={wrongAnalysis} onBack={() => { setView('list'); setWrongAnalysis(null); }} />
      )}
    </div>
  );
}

// ===== Create Mock Exam Form =====
function CreateMockExamForm({ onCreate }: { onCreate: (data: { title: string; standard: string; duration: number; totalScore: number }) => void }) {
  const [title, setTitle] = useState('');
  const [standard, setStandard] = useState('gaokao');
  const [duration, setDuration] = useState(120);
  const [totalScore, setTotalScore] = useState(150);

  return (
    <div className="create-form card">
      <h3>创建模拟考试</h3>
      <div className="form-row">
        <label>标题</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="期末模拟考试" />
      </div>
      <div className="form-row">
        <label>考试标准</label>
        <select value={standard} onChange={e => setStandard(e.target.value)}>
          <option value="gaokao">高考标准 (150分/120分钟)</option>
          <option value="midterm">期中考试 (100分/90分钟)</option>
          <option value="final">期末考试 (100分/90分钟)</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div className="form-row">
        <label>时长(分钟)</label>
        <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 120)} />
      </div>
      <div className="form-row">
        <label>满分</label>
        <input type="number" value={totalScore} onChange={e => setTotalScore(parseInt(e.target.value) || 150)} />
      </div>
      <button className="btn-primary" onClick={() => onCreate({ title, standard, duration, totalScore })} disabled={!title}>
        创建
      </button>
    </div>
  );
}

// ===== Taking Exam View =====
function TakingExam({ examId, token, onSubmit, onBack }: {
  examId: number;
  token: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const exam = await getMockExams(token).then((all: any[]) => all.find((e: any) => e.id === examId));
        if (!exam) return;
        const qIds: number[] = JSON.parse(exam.questionIds);
        // Fetch questions via papers API
        const questionsData = await Promise.all(
          qIds.map(id =>
            fetch(`http://localhost:3000/api/papers/questions/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json())
          )
        );
        setQuestions(questionsData);
        setTimeLeft(exam.duration * 60);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
  }, [examId, token]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || loading) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          onSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, onSubmit]);

  const handleAnswer = async (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    try {
      await saveMockAnswer(token, examId, { questionId, answer });
    } catch {}
  };

  const handleToggleMark = async (questionId: number) => {
    const newMarked = new Set(marked);
    if (newMarked.has(questionId)) newMarked.delete(questionId);
    else newMarked.add(questionId);
    setMarked(newMarked);
    try {
      await toggleMark(token, examId, questionId);
    } catch {}
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return <p>加载题目中...</p>;
  if (questions.length === 0) return <p>无题目</p>;

  const q = questions[currentIndex];
  const options = q?.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;

  return (
    <div className="taking-exam">
      <div className="exam-header">
        <div className="timer">{formatTime(timeLeft)}</div>
        <button className="btn-danger" onClick={() => { if (confirm('确定提交?')) onSubmit(); }}>交卷</button>
        <button className="btn-secondary" onClick={onBack}>退出</button>
      </div>

      <div className="exam-body">
        <div className="question-area">
          <div className="question-header">
            <span>第 {currentIndex + 1} / {questions.length} 题</span>
            <button className={`btn-mark ${marked.has(q.id) ? 'marked' : ''}`} onClick={() => handleToggleMark(q.id)}>
              {marked.has(q.id) ? '★ 已标记' : '☆ 标记'}
            </button>
          </div>
          <div className="question-content"><MathText text={q.content} /></div>
          {options && Array.isArray(options) && (
            <div className="options">
              {options.map((option: string, index: number) => {
                const key = String.fromCharCode(65 + index);
                return (
                  <label key={key} className={`option ${answers[q.id] === key ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`q${q.id}`}
                      checked={answers[q.id] === key}
                      onChange={() => handleAnswer(q.id, key)}
                    />
                    <span className="option-key">{key}.</span>
                    <span className="option-text"><MathText text={option} /></span>
                  </label>
                );
              })}
            </div>
          )}
          {(q.questionType === 'fill' || q.questionType === 'essay') && (
            <textarea
              value={answers[q.id] || ''}
              onChange={e => handleAnswer(q.id, e.target.value)}
              placeholder={q.questionType === 'fill' ? '请输入答案' : '请输入详细解答过程'}
              rows={q.questionType === 'essay' ? 10 : 3}
            />
          )}
        </div>

        <div className="answer-card">
          <h4>答题卡</h4>
          <div className="card-grid">
            {questions.map((qq, i) => (
              <button
                key={qq.id}
                className={`card-item ${i === currentIndex ? 'current' : ''} ${answers[qq.id] ? 'answered' : ''} ${marked.has(qq.id) ? 'marked' : ''}`}
                onClick={() => setCurrentIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="card-legend">
            <span><span className="dot answered"></span>已答</span>
            <span><span className="dot current"></span>当前</span>
            <span><span className="dot marked"></span>标记</span>
          </div>
        </div>
      </div>

      <div className="nav-buttons">
        <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)}>上一题</button>
        <button disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex(i => i + 1)}>下一题</button>
      </div>
    </div>
  );
}

// ===== Result View =====
function ResultView({ result, onBack }: { result: MockExamResult; onBack: () => void }) {
  const pct = result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
  return (
    <div className="result-view">
      <div className="result-header">
        <button className="btn-secondary" onClick={onBack}>返回</button>
        <h2>{result.exam.title}</h2>
      </div>
      <div className="score-summary card">
        <div className="big-score">
          <span className="score-num">{result.totalScore}</span>
          <span className="score-max">/{result.maxScore}</span>
        </div>
        <div className="score-pct">{pct}%</div>
        <div className="score-details">
          <span>正确: {result.correctCount}/{result.totalQuestions}</span>
          <span>用时: {Math.floor(result.totalTimeSpent / 60)}分钟</span>
          <span>标记: {result.markedCount}</span>
        </div>
      </div>
    </div>
  );
}

// ===== Benchmark View =====
function BenchmarkView({ benchmark, onBack }: { benchmark: BenchmarkAnalysis; onBack: () => void }) {
  return (
    <div className="benchmark-view">
      <div className="result-header">
        <button className="btn-secondary" onClick={onBack}>返回</button>
        <h2>对标分析</h2>
      </div>
      <div className="benchmark-grid">
        <div className="card stat-card">
          <h3>我的得分</h3>
          <p className="stat-value">{benchmark.studentScore}/{benchmark.maxScore}</p>
        </div>
        <div className="card stat-card">
          <h3>班级排名</h3>
          <p className="stat-value">{benchmark.rank}/{benchmark.totalStudents}</p>
        </div>
        <div className="card stat-card">
          <h3>百分位</h3>
          <p className="stat-value">{benchmark.percentile}%</p>
        </div>
        <div className="card stat-card">
          <h3>班级平均</h3>
          <p className="stat-value">{benchmark.classAverage}</p>
        </div>
        <div className="card stat-card">
          <h3>班级最高</h3>
          <p className="stat-value">{benchmark.classMax}</p>
        </div>
        <div className="card stat-card">
          <h3>班级最低</h3>
          <p className="stat-value">{benchmark.classMin}</p>
        </div>
      </div>
    </div>
  );
}

// ===== Wrong Analysis View =====
function WrongAnalysisView({ analysis, onBack }: { analysis: WrongQuestionAnalysis; onBack: () => void }) {
  return (
    <div className="wrong-analysis-view">
      <div className="result-header">
        <button className="btn-secondary" onClick={onBack}>返回</button>
        <h2>错题分析</h2>
      </div>
      <div className="card">
        <h3>共错 {analysis.totalWrong} 题</h3>
        {analysis.byQuestionType && analysis.byQuestionType.length > 0 && (
          <div className="kp-wrong">
            <h4>按题型分布</h4>
            {analysis.byQuestionType.map(t => (
              <div key={t.questionType} className="kp-bar">
                <span>{t.questionType}</span>
                <div className="bar-container">
                  <div className="bar-fill" style={{ width: `${(t.wrongCount / analysis.totalWrong) * 100}%` }}></div>
                </div>
                <span>{t.wrongCount}题</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="wrong-list">
        {analysis.wrongAnswers.map(a => (
          <div key={a.id} className="wrong-item card">
            <div className="wrong-q">{a.question?.content}</div>
            <div className="wrong-a">
              <span>你的答案: {a.answer || '(未作答)'}</span>
              <span>正确答案: {a.question?.answer || '(待批改)'}</span>
            </div>
            <div className="wrong-feedback">{a.feedback}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
