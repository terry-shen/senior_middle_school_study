import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStudentWorkbench, type StudentWorkbench } from '../services/learning-api';
import './Workbench.css';

const API_BASE = 'http://localhost:3000/api';

async function apiGet(token: string, path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

function extractTotal(data: any): number {
  if (data?.pagination?.total !== undefined) return data.pagination.total;
  if (data?.total !== undefined) return data.total;
  if (Array.isArray(data)) return data.length;
  if (data?.data && Array.isArray(data.data)) return data.data.length;
  return 0;
}

export default function Workbench() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<Record<string, number | string>>({});
  const [learning, setLearning] = useState<StudentWorkbench | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminStats = useCallback(async (tk: string) => {
    const results: Record<string, number | string> = {};
    const calls: { key: string; call: () => Promise<any>; extract: (d: any) => number | string }[] = [
      { key: 'papersTotal', call: () => apiGet(tk, '/papers?purpose=whole_paper&limit=1'), extract: extractTotal },
      { key: 'questionsTotal', call: () => apiGet(tk, '/papers/questions/all?limit=1'), extract: extractTotal },
      { key: 'studentsTotal', call: () => apiGet(tk, '/students?limit=1'), extract: extractTotal },
      { key: 'examsTotal', call: () => apiGet(tk, '/exam-sessions?status=published&limit=1'), extract: extractTotal },
      { key: 'pendingSheets', call: () => apiGet(tk, '/answer-sheets?status=submitted'), extract: extractTotal },
    ];
    await Promise.allSettled(
      calls.map(async ({ key, call, extract }) => {
        try {
          results[key] = extract(await call());
        } catch {
          results[key] = '--';
        }
      }),
    );
    setStats(results);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (user?.role === 'admin') {
          await loadAdminStats(token);
        } else {
          const res = await getStudentWorkbench(token);
          if (!cancelled) {
            setLearning({
              progress: res.progress ?? null,
              pendingExams: res.pendingExams ?? [],
              weakCount: res.weakCount ?? 0,
              weakTop: res.weakTop ?? [],
            });
          }
        }
      } catch {
        if (!cancelled) setLearning({ progress: null, pendingExams: [], weakCount: 0, weakTop: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token, user, loadAdminStats]);

  const adminCards = [
    { key: 'papersTotal', label: '试卷总数', icon: '📚' },
    { key: 'questionsTotal', label: '题目总数', icon: '📝' },
    { key: 'studentsTotal', label: '学生总数', icon: '👥' },
    { key: 'examsTotal', label: '已发布考试', icon: '🎯' },
    { key: 'pendingSheets', label: '待批改答题纸', icon: '✏️' },
  ];

  return (
    <div className="workbench">
      <div className="workbench-header">
        <h2>工作台</h2>
        <p>欢迎，{user?.name}（{user?.role === 'admin' ? '管理员' : '学生'}）</p>
      </div>

      {loading ? (
        <p className="workbench-loading">加载中...</p>
      ) : user?.role === 'admin' ? (
        <div className="workbench-stats">
          {adminCards.map((card) => (
            <div key={card.key} className="stat-card">
              <span className="stat-icon">{card.icon}</span>
              <div className="stat-value">{stats[card.key] ?? '--'}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="wb-learning">
          <section className="wb-block">
            <h3 className="wb-block-title">📖 继续学习</h3>
            {learning?.progress ? (
              <div className="wb-continue">
                <div className="wb-continue-text">
                  <div className="wb-continue-path">
                    {learning.progress.textbookName} / {learning.progress.chapterTitle} / {learning.progress.sectionTitle}
                  </div>
                  {learning.progress.assetName && (
                    <div className="wb-continue-asset">上次查看：{learning.progress.assetName}</div>
                  )}
                </div>
                <Link className="wb-btn wb-btn-primary" to={`/learning/section/${learning.progress.sectionId}`}>
                  继续 →
                </Link>
              </div>
            ) : (
              <div className="wb-empty">
                还没有学习记录，<Link to="/learning">去章节学习</Link> 开始吧。
              </div>
            )}
          </section>

          <section className="wb-block">
            <h3 className="wb-block-title">🎯 待做试卷</h3>
            {learning && learning.pendingExams.length > 0 ? (
              <ul className="wb-list">
                {learning.pendingExams.map((ex) => (
                  <li key={ex.id} className="wb-list-item">
                    <div className="wb-list-main">
                      <div className="wb-list-title">{ex.title}</div>
                      <div className="wb-list-meta">
                        {ex.mode === 'whole_paper' ? '整卷' : '在线'}
                        {ex.totalScore ? ` · 满分 ${ex.totalScore}` : ''}
                        {ex.duration ? ` · ${ex.duration} 分钟` : ''}
                      </div>
                    </div>
                    <Link className="wb-btn" to="/mock-exams">去考试</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="wb-empty">暂无待完成的试卷。</div>
            )}
          </section>

          <section className="wb-block">
            <h3 className="wb-block-title">
              ❌ 错题提醒
              {learning && learning.weakCount > 0 && <span className="wb-count">{learning.weakCount}</span>}
            </h3>
            {learning && learning.weakTop.length > 0 ? (
              <>
                <ul className="wb-list">
                  {learning.weakTop.map((w) => (
                    <li key={w.id} className="wb-list-item">
                      <div className="wb-list-main">
                        <div className="wb-list-title wb-line-clamp">{w.content}</div>
                        <div className="wb-list-meta">{w.questionType}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="wb-more">
                  <Link to="/wrong-questions">查看全部错题 →</Link>
                </div>
              </>
            ) : (
              <div className="wb-empty">暂无未掌握的错题。</div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
