import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getPendingAnswerSheets,
  getMyAnswerSheets,
  normalizeSheetUrl,
  type AnswerSheet,
} from '../services/answer-sheets-api';
import './AnswerSheets.css';

export default function AnswerSheetsList() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [tab, setTab] = useState<'pending' | 'graded' | 'mine'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const status = tab === 'pending' ? 'submitted' : tab === 'graded' ? 'graded' : 'all';
        // 'mine' 不应在 admin 出现，但保留兼容
        const { answerSheets } = await getPendingAnswerSheets(token!, status === 'all' ? 'all' : status);
        setSheets(answerSheets);
      } else {
        const { answerSheets } = await getMyAnswerSheets(token!);
        setSheets(answerSheets);
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  return (
    <div className="answer-sheets-page">
      <h1>{isAdmin ? '答题纸阅卷' : '我的答题纸'}</h1>

      {isAdmin && (
        <div className="tabs">
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>待批改</button>
          <button className={tab === 'graded' ? 'active' : ''} onClick={() => setTab('graded')}>已批改</button>
        </div>
      )}

      {loading && <p>加载中...</p>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && sheets.length === 0 && <p className="empty">暂无答题纸</p>}

      {!loading && sheets.length > 0 && (
        <table className="sheets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>场景</th>
              <th>学生</th>
              <th>文件</th>
              <th>类型</th>
              <th>状态</th>
              <th>得分</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.sceneTitle}{s.sceneType ? ` (${s.sceneType})` : ''}</td>
                <td>{s.student?.name || '-'}{s.student?.studentId ? ` (${s.student.studentId})` : ''}</td>
                <td>
                  {s.fileType === 'image' ? (
                    <a href={normalizeSheetUrl(s.fileUrl)} target="_blank" rel="noreferrer">查看图片</a>
                  ) : (
                    <a href={normalizeSheetUrl(s.fileUrl)} target="_blank" rel="noreferrer">下载</a>
                  )}
                </td>
                <td>{s.fileType === 'image' ? '图片' : 'Word'}</td>
                <td>
                  <span className={`badge badge-${s.status}`}>
                    {s.status === 'submitted' ? '待批改' : '已批改'}
                  </span>
                </td>
                <td>{s.totalScore ?? '-'}</td>
                <td>{new Date(s.createdAt).toLocaleString('zh-CN')}</td>
                <td>
                  <button className="btn-view" onClick={() => navigate(`/answer-sheets/${s.id}`)}>
                    {isAdmin ? (s.status === 'submitted' ? '批改' : '查看/修改') : '查看批改'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}