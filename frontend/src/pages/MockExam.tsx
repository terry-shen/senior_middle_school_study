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
  type MockExam,
  type MockExamResult,
  type BenchmarkAnalysis,
} from '../services/mock-exams-api';
import { generateExam, type ExamGenerationParams } from '../services/exams-api';
import { createExamSession } from '../services/exam-sessions-api';
import { getPaperLibrary } from '../services/papers-api';
import './MockExam.css';

type View = 'list' | 'taking' | 'result' | 'benchmark' | 'answer-sheet';

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

  // Admin: Create mock exam (three sources: manual / auto from question bank / whole paper from library)
  const handleCreate = async (payload: {
    source: 'manual' | 'auto' | 'library';
    title: string;
    standard: string;
    duration: number;
    totalScore: number;
    typeDistribution?: Record<string, number>;
    paperId?: number;
  }) => {
    if (!token) return;
    try {
      if (payload.source === 'auto') {
        await generateExam(token, {
          name: payload.title,
          totalScore: payload.totalScore,
          duration: payload.duration,
          typeDistribution: (payload.typeDistribution || {}) as ExamGenerationParams['typeDistribution'],
          scoreDistribution: { single_choice: 5, multiple_choice: 5, fill: 10, essay: 15 },
        });
      } else if (payload.source === 'library' && payload.paperId) {
        await createExamSession(token, {
          title: payload.title,
          mode: 'whole_paper',
          source: 'library',
          paperId: payload.paperId,
          totalScore: payload.totalScore,
          duration: payload.duration,
        });
      } else {
        await createMockExam(token, {
          title: payload.title,
          standard: payload.standard,
          duration: payload.duration,
          totalScore: payload.totalScore,
        });
      }
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
            scene={{ examSessionId: currentExamId }}
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
              scene={{ examSessionId: currentExamId }}
              sceneLabel="模拟考试"
            />
          )}
        </>
      )}

      {view === 'benchmark' && benchmark && (
        <BenchmarkView benchmark={benchmark} onBack={() => { setView('list'); setBenchmark(null); }} />
      )}
    </div>
  );
}

// ===== Create Mock Exam Form =====
export type CreateExamPayload = {
  source: 'manual' | 'auto' | 'library';
  title: string;
  standard: string;
  duration: number;
  totalScore: number;
  typeDistribution?: Record<string, number>;
  paperId?: number;
};

function CreateMockExamForm({ onCreate }: { onCreate: (data: CreateExamPayload) => Promise<void> }) {
  const { token } = useAuth();
  const [source, setSource] = useState<'manual' | 'auto' | 'library'>('manual');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // manual fields
  const [title, setTitle] = useState('');
  const [standard, setStandard] = useState('gaokao');
  const [duration, setDuration] = useState(120);
  const [totalScore, setTotalScore] = useState(150);

  // auto fields (question bank composition)
  const [autoTitle, setAutoTitle] = useState('');
  const [dist, setDist] = useState<Record<string, number>>({ single_choice: 8, multiple_choice: 2, fill: 4, essay: 3 });
  const distLabels: Record<string, string> = { single_choice: '单选题', multiple_choice: '多选题', fill: '填空题', essay: '解答题' };

  // library fields (whole paper)
  const [papers, setPapers] = useState<any[]>([]);
  const [paperId, setPaperId] = useState<number | ''>('');
  const [libDuration, setLibDuration] = useState(120);
  const [loadingPapers, setLoadingPapers] = useState(false);

  useEffect(() => {
    if (source === 'library' && token && papers.length === 0) {
      setLoadingPapers(true);
      getPaperLibrary(token, { purpose: 'whole_paper', page: 1, limit: 500 })
        .then((d: any) => {
          const list = d?.data || [];
          setPapers(list);
          if (list.length === 0) setFormError('试卷库中暂无整卷试卷，请先到「试卷库」导入');
          else setFormError('');
        })
        .catch((e: any) => setFormError(e.message || '试卷库加载失败'))
        .finally(() => setLoadingPapers(false));
    }
  }, [source, token, papers.length]);

  const handleAutoSubmit = async () => {
    const total = Object.values(dist).reduce((s, v) => s + (v || 0), 0);
    if (total === 0) { setFormError('请至少设置一种题型的数量'); return; }
    setCreating(true);
    setFormError('');
    try {
      await onCreate({
        source: 'auto',
        title: autoTitle || `自动组卷试卷 ${new Date().toLocaleDateString()}`,
        standard: 'custom',
        duration,
        totalScore,
        typeDistribution: dist,
      });
    } catch (e: any) {
      setFormError(e.message || '自动组卷失败');
    } finally {
      setCreating(false);
    }
  };

  const handleLibrarySubmit = async () => {
    const paper = papers.find(p => p.id === Number(paperId));
    if (!paper) { setFormError('请选择一份试卷'); return; }
    setCreating(true);
    setFormError('');
    try {
      await onCreate({
        source: 'library',
        title: paper.title,
        standard: 'custom',
        duration: libDuration || paper.duration || 120,
        totalScore: paper.totalScore || 150,
        paperId: paper.id,
      });
    } catch (e: any) {
      setFormError(e.message || '整卷发布失败');
    } finally {
      setCreating(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!title) return;
    setCreating(true);
    setFormError('');
    try {
      await onCreate({ source: 'manual', title, standard, duration, totalScore });
    } catch (e: any) {
      setFormError(e.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-form card">
      <h3>创建模拟考试</h3>
      {formError && <div className="error-msg">{formError}</div>}
      <div className="form-row source-tabs">
        <label className={source === 'manual' ? 'active' : ''} onClick={() => { setSource('manual'); setFormError(''); }}>📝 手动创建</label>
        <label className={source === 'auto' ? 'active' : ''} onClick={() => { setSource('auto'); setFormError(''); }}>🤖 题库自动组卷</label>
        <label className={source === 'library' ? 'active' : ''} onClick={() => { setSource('library'); setFormError(''); }}>📚 试卷库整卷</label>
      </div>

      {source === 'manual' && (
        <>
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
          <button className="btn-primary" onClick={handleManualSubmit} disabled={!title || creating}>
            {creating ? '创建中...' : '创建'}
          </button>
        </>
      )}

      {source === 'auto' && (
        <>
          <p className="source-hint">从题库中按题型分布随机选题组卷（仅含题库中已导入的题目）</p>
          <div className="form-row">
            <label>试卷标题</label>
            <input value={autoTitle} onChange={e => setAutoTitle(e.target.value)} placeholder="留空自动生成标题" />
          </div>
          {Object.keys(dist).map(key => (
            <div className="form-row" key={key}>
              <label>{distLabels[key] || key} 题数</label>
              <input
                type="number"
                min={0}
                value={dist[key]}
                onChange={e => setDist({ ...dist, [key]: parseInt(e.target.value) || 0 })}
              />
            </div>
          ))}
          <div className="form-row">
            <label>时长(分钟)</label>
            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 120)} />
          </div>
          <div className="form-row">
            <label>满分</label>
            <input type="number" value={totalScore} onChange={e => setTotalScore(parseInt(e.target.value) || 150)} />
          </div>
          <button className="btn-primary" onClick={handleAutoSubmit} disabled={creating}>
            {creating ? '组卷中...' : '自动组卷'}
          </button>
        </>
      )}

      {source === 'library' && (
        <>
          <p className="source-hint">选择试卷库中的一份整卷直接发布，学生下载试卷线下作答、上传答题纸，老师离线批改</p>
          {loadingPapers ? (
            <p>试卷库加载中...</p>
          ) : (
            <>
              <div className="form-row">
                <label>选择试卷</label>
                <select value={paperId} onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  setPaperId(id);
                  const p = papers.find(x => x.id === id);
                  if (p) setLibDuration(p.duration || 120);
                }}>
                  <option value="">请选择...</option>
                  {papers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}（{p.totalScore || '?'}分/{p.duration || '?'}分钟{p.subject ? ` · ${p.subject}` : ''}{p.year ? ` · ${p.year}` : ''}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>时长(分钟)</label>
                <input type="number" value={libDuration} onChange={e => setLibDuration(parseInt(e.target.value) || 120)} />
              </div>
              <button className="btn-primary" onClick={handleLibrarySubmit} disabled={!paperId || creating}>
                {creating ? '发布中...' : '发布整卷考试'}
              </button>
            </>
          )}
        </>
      )}
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
      await saveMockAnswer(token, examId, questionId, answer);
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
