import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './StudentManagement.css';

interface Student {
  id: number;
  studentId: string;
  name: string;
  role: 'student' | 'admin';
  classId?: number | null;
  class?: {
    id: number;
    name: string;
    grade: string;
  } | null;
}

interface ClassOption {
  id: number;
  name: string;
  grade: string;
}

const PAGE_SIZE = 10;

const emptyCreateForm = {
  studentId: '',
  name: '',
  password: '',
  classId: '',
  role: 'student' as 'student' | 'admin',
};

export default function StudentManagement() {
  const { user, token } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const [createMode, setCreateMode] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyCreateForm });
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', classId: '', password: '' });
  const [editError, setEditError] = useState('');

  const [importMode, setImportMode] = useState(false);
  const [importData, setImportData] = useState('');
  const [importType, setImportType] = useState<'csv' | 'json'>('json');

  const fetchStudents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(searchQuery ? { search: searchQuery } : {}),
      });
      const response = await fetch(`/api/students?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '加载学生列表失败');
      const list: Student[] = data.students || data.data || [];
      setStudents(list);
      setTotal(data.pagination?.total ?? list.length);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载学生列表失败');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, searchQuery]);

  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch('/api/classes/list');
      const data = await response.json();
      setClasses(Array.isArray(data) ? data : data.classes || []);
    } catch {
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const openCreate = () => {
    setCreateForm({ ...emptyCreateForm });
    setCreateError('');
    setCreateMode(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setCreateError('');
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: createForm.studentId.trim(),
          name: createForm.name.trim(),
          password: createForm.password,
          role: createForm.role,
          classId: createForm.classId ? parseInt(createForm.classId) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '新增失败');
      setCreateMode(false);
      setPage(1);
      await fetchStudents();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '新增失败');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditForm({
      name: student.name,
      classId: student.classId ? String(student.classId) : '',
      password: '',
    });
    setEditError('');
    setEditMode(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !token) return;
    setSaving(true);
    setEditError('');
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        classId: editForm.classId ? parseInt(editForm.classId) : null,
      };
      if (editForm.password) payload.password = editForm.password;

      const response = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '保存失败');
      setEditMode(false);
      await fetchStudents();
      if (data?.passwordChanged) {
        alert('密码已更新，该学生已登录的会话已失效，需重新登录。');
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!token) return;
    if (!confirm(`确定要删除学生「${student.name}（${student.studentId}）」吗？此操作不可恢复。`)) return;
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '删除失败');
      await fetchStudents();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const endpoint = importType === 'csv' ? '/api/students/import/csv' : '/api/students/import/json';
      const body = importType === 'csv' ? importData : JSON.parse(importData);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': importType === 'csv' ? 'text/plain' : 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: importType === 'csv' ? body : JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        alert(`成功导入 ${data.count} 个学生`);
        setImportMode(false);
        setImportData('');
        await fetchStudents();
      } else {
        alert(`导入失败: ${data.error}`);
      }
    } catch {
      alert('导入失败: 数据格式错误');
    }
  };

  const applySearch = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  if (user?.role !== 'admin') {
    return (
      <div className="error-page">
        <h2>权限不足</h2>
        <p>您没有权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="student-management">
      <div className="page-header">
        <div className="page-title">
          <h1>学生管理</h1>
          <span className="page-sub">共 {total} 人</span>
        </div>
        <div className="page-actions">
          <button onClick={openCreate} className="btn-primary">+ 新增学生</button>
          <button onClick={() => setImportMode(true)} className="btn-ghost">批量导入</button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索学号或姓名..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearch();
          }}
        />
        <button className="btn-ghost" onClick={applySearch}>搜索</button>
        {searchQuery && (
          <button
            className="btn-link"
            onClick={() => {
              setSearchInput('');
              setSearchQuery('');
              setPage(1);
            }}
          >
            清除
          </button>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : students.length === 0 ? (
        <div className="empty-state">暂无学生记录{searchQuery ? '，试试其他关键词' : '，点击右上角「新增学生」开始'}</div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th className="col-secondary">角色</th>
                  <th>班级</th>
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="mono">{student.studentId}</td>
                    <td>{student.name}</td>
                    <td className="col-secondary">
                      <span className={student.role === 'admin' ? 'role-badge admin' : 'role-badge'}>
                        {student.role === 'admin' ? '管理员' : '学生'}
                      </span>
                    </td>
                    <td>{student.class ? `${student.class.grade} - ${student.class.name}` : '-'}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button onClick={() => openEdit(student)} className="btn-small">编辑 / 改密</button>
                        <button
                          onClick={() => handleDelete(student)}
                          className="btn-small btn-danger"
                          disabled={student.id === user?.id}
                          title={student.id === user?.id ? '不能删除当前登录账号' : undefined}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
            <span>第 {page} / {Math.max(1, totalPages)} 页</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</button>
          </div>
        </>
      )}

      {createMode && (
        <div className="modal-overlay" onClick={() => setCreateMode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>新增学生</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>学号 *</label>
                <input
                  type="text"
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                  placeholder="例如 2026006"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>姓名 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="学生姓名"
                  required
                />
              </div>
              <div className="form-group">
                <label>登录密码 *</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="至少 6 位"
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>班级</label>
                <select
                  value={createForm.classId}
                  onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                >
                  <option value="">无班级</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.grade} - {cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>角色</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'student' | 'admin' })}
                >
                  <option value="student">学生</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              {createError && <div className="alert-error">{createError}</div>}
              <div className="modal-actions">
                <button type="button" onClick={() => setCreateMode(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '保存中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMode && selectedStudent && (
        <div className="modal-overlay" onClick={() => setEditMode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>编辑学生信息</h2>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>学号</label>
                <input type="text" value={selectedStudent.studentId} disabled />
              </div>
              <div className="form-group">
                <label>姓名 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>班级</label>
                <select
                  value={editForm.classId}
                  onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}
                >
                  <option value="">无班级</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.grade} - {cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>重置登录密码</label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="留空则不修改"
                />
                <p className="field-hint">填写后该学生会被强制下线，需用新密码重新登录。</p>
              </div>
              {editError && <div className="alert-error">{editError}</div>}
              <div className="modal-actions">
                <button type="button" onClick={() => setEditMode(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importMode && (
        <div className="modal-overlay" onClick={() => setImportMode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入学生</h2>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>导入格式</label>
                <div className="radio-group">
                  <label>
                    <input type="radio" checked={importType === 'json'} onChange={() => setImportType('json')} />
                    JSON
                  </label>
                  <label>
                    <input type="radio" checked={importType === 'csv'} onChange={() => setImportType('csv')} />
                    CSV
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>数据内容</label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={8}
                  placeholder={
                    importType === 'json'
                      ? '[\n  {"studentId": "001", "name": "张三", "classId": 1},\n  ...\n]'
                      : 'studentId,name,classId\n001,张三,1\n...'
                  }
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setImportMode(false)}>取消</button>
                <button type="submit" className="btn-primary">导入</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
