import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const loadStats = async () => {
      setLoading(true);
      const isAdmin = user?.role === 'admin';
      const results: Record<string, number | string> = {};

      const adminCalls: { key: string; call: () => Promise<any>; extract: (d: any) => number | string }[] = [
        { key: 'papersTotal', call: () => apiGet(token, '/papers?purpose=whole_paper&limit=1'), extract: extractTotal },
        { key: 'questionsTotal', call: () => apiGet(token, '/papers/questions/all?limit=1'), extract: extractTotal },
        { key: 'studentsTotal', call: () => apiGet(token, '/students?limit=1'), extract: extractTotal },
        { key: 'examsTotal', call: () => apiGet(token, '/exam-sessions?status=published&limit=1'), extract: extractTotal },
        { key: 'pendingSheets', call: () => apiGet(token, '/answer-sheets?status=submitted'), extract: extractTotal },
      ];

      const studentCalls: { key: string; call: () => Promise<any>; extract: (d: any) => number | string }[] = [
        { key: 'pendingExams', call: () => apiGet(token, '/exam-sessions/student/all'), extract: extractTotal },
        { key: 'wrongStats', call: () => apiGet(token, '/wrong-questions/stats'), extract: (d) => d?.total ?? 0 },
        { key: 'masteredWrong', call: () => apiGet(token, '/wrong-questions/stats'), extract: (d) => d?.mastered ?? 0 },
        { key: 'streakDays', call: () => apiGet(token, '/incentive/stats'), extract: (d) => d?.currentStreak ?? 0 },
      ];

      const calls = isAdmin ? adminCalls : studentCalls;
      await Promise.allSettled(
        calls.map(async ({ key, call, extract }) => {
          try {
            const data = await call();
            results[key] = extract(data);
          } catch {
            results[key] = '--';
          }
        })
      );
      setStats(results);
      setLoading(false);
    };
    loadStats();
  }, [token, user]);

  const adminCards = [
    { key: 'papersTotal', label: '试卷总数', icon: '📚' },
    { key: 'questionsTotal', label: '题目总数', icon: '📝' },
    { key: 'studentsTotal', label: '学生总数', icon: '👥' },
    { key: 'examsTotal', label: '已发布考试', icon: '🎯' },
    { key: 'pendingSheets', label: '待批改答题纸', icon: '✏️' },
  ];

  const studentCards = [
    { key: 'pendingExams', label: '待完成考试', icon: '🎯' },
    { key: 'wrongStats', label: '错题总数', icon: '❌' },
    { key: 'masteredWrong', label: '已掌握错题', icon: '✅' },
    { key: 'streakDays', label: '学习连续天数', icon: '🔥' },
  ];

  const cards = user?.role === 'admin' ? adminCards : studentCards;

  return (
    <div className="workbench">
      <div className="workbench-header">
        <h2>工作台</h2>
        <p>欢迎，{user?.name}（{user?.role === 'admin' ? '管理员' : '学生'}）</p>
      </div>
      {loading ? (
        <p className="workbench-loading">加载中...</p>
      ) : (
        <div className="workbench-stats">
          {cards.map((card) => (
            <div key={card.key} className="stat-card">
              <span className="stat-icon">{card.icon}</span>
              <div className="stat-value">{stats[card.key] ?? '--'}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
