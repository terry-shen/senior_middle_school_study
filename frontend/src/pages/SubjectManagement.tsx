import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSubjects, createSubject, updateSubject, deleteSubject, getSubjectUsage, type Subject } from '../services/subjects-api';
import './SubjectManagement.css';

interface EditForm {
  code: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
}

const emptyForm: EditForm = { code: '', name: '', icon: '', color: '', order: 99, isActive: true };

export default function SubjectManagement() {
  const { user, token } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [usage, setUsage] = useState<{ id: number; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getSubjects();
      setSubjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
  };

  const openEdit = (s: Subject) => {
    setEditingId(s.id);
    setForm({ code: s.code, name: s.name, icon: s.icon || '', color: s.color || '', order: s.order, isActive: s.isActive });
    setShowForm(true);
    setMessage('');
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.name.trim()) { setError('请填写学科名称'); return; }
    try {
      setError('');
      if (editingId == null) {
        if (!form.code.trim()) { setError('新增学科必须填写标识 code'); return; }
        await createSubject(token, {
          code: form.code.trim(),
          name: form.name.trim(),
          icon: form.icon.trim() || undefined,
          color: form.color.trim() || undefined,
          order: form.order,
        });
        setMessage(`已创建学科「${form.name.trim()}」`);
      } else {
        await updateSubject(token, editingId, {
          name: form.name.trim(),
          icon: form.icon.trim() || null,
          color: form.color.trim() || null,
          order: form.order,
          isActive: form.isActive,
        });
        setMessage(`已更新学科「${form.name.trim()}」`);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  };

  const handleToggle = async (s: Subject) => {
    if (!token) return;
    try {
      setError('');
      await updateSubject(token, s.id, { isActive: !s.isActive });
      setMessage(`已${s.isActive ? '停用' : '启用'}学科「${s.name}」`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (s: Subject) => {
    if (!token) return;
    try {
      setError('');
      const u = await getSubjectUsage(token, s.id);
      if (u.total > 0) {
        setUsage({ id: s.id, text: `试卷 ${u.papers} · 题目 ${u.questions} · 考试 ${u.examSessions} · 错题 ${u.wrongQuestions} · 知识点 ${u.knowledgePoints}` });
        setError(`学科「${s.name}」有关联数据，无法删除（可改为停用）`);
        return;
      }
      if (!window.confirm(`确认删除学科「${s.name}」？`)) return;
      await deleteSubject(token, s.id);
      setMessage(`已删除学科「${s.name}」`);
      setUsage(null);
      await load();
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      if (err.statusCode === 409) setError('该学科有关联业务数据，无法删除（可改为停用）');
      else setError(err.message || '删除失败');
    }
  };

  if (!isAdmin) {
    return <div className="page"><div className="empty">仅管理员可访问学科管理</div></div>;
  }

  return (
    <div className="page subject-management">
      <div className="page-header">
        <h1>🗂️ 学科管理</h1>
        <button className="btn-primary" onClick={openCreate}>+ 新增学科</button>
      </div>

      {message && <div className="msg-success">{message}</div>}
      {error && <div className="msg-error">
        {error}
        {usage && <span className="usage-hint">（{usage.text}）</span>}
      </div>}

      {showForm && (
        <div className="subject-form card">
          <h3>{editingId == null ? '新增学科' : `编辑学科${form.code ? `（${form.code}）` : ''}`}</h3>
          <div className="form-grid">
            <label>
              标识 code{editingId != null && <span className="hint">（不可修改）</span>}
              <input
                value={form.code}
                disabled={editingId != null}
                placeholder="如 physics"
                onChange={e => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label>
              名称 *
              <input value={form.name} placeholder="如 物理" onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              图标
              <input value={form.icon} placeholder="如 ⚗️" onChange={e => setForm({ ...form, icon: e.target.value })} />
            </label>
            <label>
              颜色
              <input value={form.color} placeholder="如 #4a90d9" onChange={e => setForm({ ...form, color: e.target.value })} />
            </label>
            <label>
              排序
              <input
                type="number"
                value={form.order}
                onChange={e => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            {editingId != null && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                />
                启用（停用后不出现在学科切换器）
              </label>
            )}
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave}>保存</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : subjects.length === 0 ? (
        <div className="empty">暂无学科，请先执行种子脚本或新增</div>
      ) : (
        <table className="subject-table">
          <thead>
            <tr>
              <th>排序</th>
              <th>图标</th>
              <th>名称</th>
              <th>code</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => (
              <tr key={s.id} className={s.isActive ? '' : 'row-inactive'}>
                <td>{s.order}</td>
                <td className="icon-cell">{s.icon || '—'}</td>
                <td>{s.name}</td>
                <td><code>{s.code}</code></td>
                <td>
                  <span className={`status-badge ${s.isActive ? 'active' : 'inactive'}`}>
                    {s.isActive ? '启用' : '停用'}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn-small" onClick={() => openEdit(s)}>编辑</button>
                  <button className="btn-small" onClick={() => handleToggle(s)}>{s.isActive ? '停用' : '启用'}</button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(s)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
