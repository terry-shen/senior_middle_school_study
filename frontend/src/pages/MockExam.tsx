/**
 * 模拟考试（v2 / M5）
 *
 * v2 只保留整卷考试：试卷库发布整卷 → 学生下载试卷线下作答 → 上传答题纸 → 老师离线批改。
 * 在线逐题作答（mode=online）已在后端停用，这里不再提供答题入口。
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ExamAssignDialog from '../components/ExamAssignDialog';
import AnswerSheetUpload from '../components/AnswerSheetUpload';
import SubjectSelect from '../components/SubjectSelect';
import {
  getMockExams,
  getMockExamHistory,
  publishMockExam,
  deleteMockExam,
  cancelMockExam,
  type MockExam,
} from '../services/mock-exams-api';
import { createExamSession } from '../services/exam-sessions-api';
import {
  getPaperLibrary,
  downloadWholePaperFile,
  triggerBlobDownload,
  type ExamPaper,
} from '../services/papers-api';
import { getSelectedSubjectId } from '../services/subjects-api';
import './MockExam.css';

type View = 'list' | 'answer-sheet';

function isWholePaperExam(exam: MockExam): boolean {
  return exam.mode === 'whole_paper' || (!!exam.paperId && !exam.questionIds);
}

export default function MockExam() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState<View>('list');
  const [exams, setExams] = useState<MockExam[]>([]);
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ id: number; title: string } | null>(null);

  const loadExams = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const list = isAdmin ? await getMockExams(token) : await getMockExamHistory(token);
      setExams(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e.message || '考试列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const handleCreate = async (payload: {
    title: string;
    paperId: number;
    totalScore?: number;
    duration?: number;
    subjectId?: number | null;
  }) => {
    if (!token) return;
    const res = await createExamSession(token, {
      title: payload.title,
      mode: 'whole_paper',
      source: 'library',
      paperId: payload.paperId,
      totalScore: payload.totalScore,
      duration: payload.duration,
      subjectId: payload.subjectId ?? undefined,
    });
    if (!res?.success) throw new Error(res?.error || '创建失败');
    setShowCreate(false);
    await loadExams();
  };

  const handlePublish = async (payload: {
    classIds: number[];
    studentIds: number[];
    startTime?: string;
    endTime?: string;
  }) => {
    if (!token || !assignTarget) return;
    const res = await publishMockExam(token, assignTarget.id, payload);
    if (!res.success) throw new Error(res.error || '发布失败');
    setAssignTarget(null);
    await loadExams();
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('确定删除该考试吗？')) return;
    try {
      await deleteMockExam(token, id);
      await loadExams();
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  };

  const handleCancel = async (id: number, title: string) => {
    if (!token || !confirm(`确定取消考试「${title}」吗？学生端将不再可见。`)) return;
    try {
      const res = await cancelMockExam(token, id);
      if (!res.success) throw new Error(res.error || '取消失败');
      await loadExams();
    } catch (e: any) {
      setError(e.message || '取消失败');
    }
  };

  const handleDownloadPaper = async (exam: MockExam) => {
    if (!token || !exam.paper?.id) {
      setError('该考试未关联试卷文件');
      return;
    }
    try {
      const { blob, filename } = await downloadWholePaperFile(token, exam.paper.id, `${exam.title}.pdf`);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      setError(e.message || '下载失败');
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'gray',
      published: 'blue',
      ongoing: 'orange',
      graded: 'green',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      ongoing: '进行中',
      graded: '已结束',
    };
    return <span className={`badge ${colors[status] || 'gray'}`}>{labels[status] || status}</span>;
  };

  if (loading && exams.length === 0) {
    return <div className="mock-exam-page"><p>加载中...</p></div>;
  }

  return (
    <div className="mock-exam-page">
      <h1>模拟考试</h1>
      {error && <div className="error-msg">{error}</div>}

      {view === 'list' && (
        <>
          <div className="header-bar">
            {isAdmin && (
              <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? '取消' : '创建整卷考试'}
              </button>
            )}
            {!isAdmin && <Link className="btn-secondary" to="/answer-sheets">我的答题纸</Link>}
            <button className="btn-secondary" onClick={loadExams}>刷新</button>
          </div>

          {showCreate && isAdmin && token && (
            <CreateWholePaperForm token={token} onCreate={handleCreate} />
          )}

          {exams.length === 0 ? (
            <p className="empty">暂无模拟考试</p>
          ) : (
            <table className="exam-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>满分</th>
                  <th>时长</th>
                  <th>状态</th>
                  {isAdmin ? <th>操作</th> : <><th>得分</th><th>操作</th></>}
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td>{exam.title}</td>
                    <td>{exam.totalScore}</td>
                    <td>{exam.duration}分钟</td>
                    <td>{statusBadge(exam.status)}</td>
                    {isAdmin ? (
                      <td>
                        {exam.status === 'draft' && (
                          <button className="btn-small" onClick={() => setAssignTarget({ id: exam.id, title: exam.title })}>
                            发布
                          </button>
                        )}
                        {(exam.status === 'published' || exam.status === 'ongoing' || exam.status === 'graded') && (
                          <button className="btn-small" onClick={() => handleCancel(exam.id, exam.title)}>取消考试</button>
                        )}
                        <button className="btn-small btn-danger" onClick={() => handleDelete(exam.id)}>删除</button>
                      </td>
                    ) : (
                      <>
                        <td>
                          {exam.studentScore !== undefined && exam.studentScore !== null
                            ? `${exam.studentScore}/${exam.totalScore}`
                            : '-'}
                        </td>
                        <td>
                          {(exam.status === 'published' || exam.status === 'ongoing') && (
                            <>
                              <button className="btn-small" onClick={() => handleDownloadPaper(exam)}>下载试卷</button>
                              <button
                                className="btn-small"
                                onClick={() => {
                                  setCurrentExamId(exam.id);
                                  setView('answer-sheet');
                                }}
                              >
                                上传答题纸
                              </button>
                            </>
                          )}
                          {exam.status === 'graded' && (
                            <Link className="btn-small" to="/answer-sheets">查看批改</Link>
                          )}
                          {!isWholePaperExam(exam) && <span className="muted">（历史在线测验）</span>}
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

      {view === 'answer-sheet' && currentExamId && token && (
        <div className="answer-sheet-view">
          <div className="header-bar">
            <button className="btn-secondary" onClick={() => { setView('list'); setCurrentExamId(null); }}>
              ← 返回列表
            </button>
          </div>
          <AnswerSheetUpload token={token} scene={{ examSessionId: currentExamId }} />
        </div>
      )}

      <ExamAssignDialog
        visible={!!assignTarget}
        title={assignTarget ? `发布考试：${assignTarget.title}` : ''}
        confirmLabel="发布"
        onClose={() => setAssignTarget(null)}
        onConfirm={handlePublish}
      />
    </div>
  );
}

// ===== 创建整卷考试（仅试卷库整卷） =====

interface CreateFormProps {
  token: string;
  onCreate: (payload: {
    title: string;
    paperId: number;
    totalScore?: number;
    duration?: number;
    subjectId?: number | null;
  }) => Promise<void>;
}

function CreateWholePaperForm({ token, onCreate }: CreateFormProps) {
  const [subjectId, setSubjectId] = useState<number | null>(getSelectedSubjectId());
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [paperId, setPaperId] = useState<number | ''>('');
  const [duration, setDuration] = useState(120);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingPapers(true);
    getPaperLibrary(token, {
      purpose: 'whole_paper',
      page: 1,
      limit: 500,
      ...(subjectId ? { subjectId } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        setPapers(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setPapers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPapers(false);
      });
    return () => { cancelled = true; };
  }, [token, subjectId]);

  const selectedPaper = papers.find((p) => p.id === paperId);

  const handleSubmit = async () => {
    if (!selectedPaper) {
      setFormError('请选择试卷');
      return;
    }
    setFormError('');
    setCreating(true);
    try {
      await onCreate({
        title: selectedPaper.title,
        paperId: selectedPaper.id,
        totalScore: selectedPaper.totalScore,
        duration,
        subjectId,
      });
    } catch (e: any) {
      setFormError(e.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-form">
      <p className="source-hint">
        选择试卷库中的一份整卷创建考试；发布后学生下载试卷线下作答、上传答题纸，老师离线批改。
      </p>
      <div className="form-row">
        <label>学科</label>
        <SubjectSelect value={subjectId} onChange={(v) => { setSubjectId(v); setPaperId(''); }} />
      </div>
      <div className="form-row">
        <label>试卷</label>
        <select
          value={paperId === '' ? '' : String(paperId)}
          onChange={(e) => setPaperId(e.target.value ? Number(e.target.value) : '')}
          disabled={loadingPapers}
        >
          <option value="">{loadingPapers ? '加载中...' : '请选择整卷试卷'}</option>
          {papers.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.title}（{p.totalScore ?? '—'}分）
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>考试时长（分钟）</label>
        <input
          type="number"
          min={10}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 120)}
        />
      </div>
      {formError && <div className="error-msg">{formError}</div>}
      <div className="form-row">
        <button className="btn-primary" disabled={creating} onClick={handleSubmit}>
          {creating ? '创建中...' : '创建整卷考试'}
        </button>
      </div>
    </div>
  );
}
