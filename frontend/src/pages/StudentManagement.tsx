import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './StudentManagement.css';

interface Student {
  id: number;
  studentId: string;
  name: string;
  role: 'student' | 'admin';
  classId?: number;
  class?: {
    id: number;
    name: string;
    grade: string;
  };
}

export default function StudentManagement() {
  const { user, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [importMode, setImportMode] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    classId: '',
  });

  // Import state
  const [importData, setImportData] = useState('');
  const [importType, setImportType] = useState<'csv' | 'json'>('json');

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [page, searchQuery]);

  const fetchStudents = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(searchQuery && { search: searchQuery }),
      });
      
      const response = await fetch(`http://localhost:3000/api/students?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      const studentsArray = data.data || data.students || [];
      if (studentsArray.length > 0 || data.data) {
        setStudents(studentsArray);
        setTotalPages(data.pagination?.totalPages || Math.ceil((data.total || 0) / 10));
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/classes/list');
      const data = await response.json();
      setClasses(data.classes || data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const handleEdit = async (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      classId: student.classId?.toString() || '',
    });
    setEditMode(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !token) return;

    try {
      const response = await fetch(`http://localhost:3000/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          classId: formData.classId ? parseInt(formData.classId) : null,
        }),
      });

      if (response.ok) {
        setEditMode(false);
        fetchStudents();
      }
    } catch (error) {
      console.error('Failed to update student:', error);
    }
  };

  const handleDelete = async (studentId: number) => {
    if (!token || !confirm('确定要删除这个学生吗？')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchStudents();
      }
    } catch (error) {
      console.error('Failed to delete student:', error);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const endpoint = importType === 'csv' 
        ? 'http://localhost:3000/api/students/import/csv'
        : 'http://localhost:3000/api/students/import/json';
      
      const body = importType === 'csv' 
        ? importData
        : JSON.parse(importData);

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
        fetchStudents();
      } else {
        alert(`导入失败: ${data.error}`);
      }
    } catch (error) {
      alert('导入失败: 数据格式错误');
    }
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
        <h1>学生管理</h1>
        <button onClick={() => setImportMode(true)} className="btn-primary">
          批量导入
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索学号或姓名..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>学号</th>
                <th>姓名</th>
                <th>角色</th>
                <th>班级</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.studentId}</td>
                  <td>{student.name}</td>
                  <td>{student.role === 'admin' ? '管理员' : '学生'}</td>
                  <td>{student.class ? `${student.class.grade} - ${student.class.name}` : '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(student)} className="btn-small">
                      编辑
                    </button>
                    <button 
                      onClick={() => handleDelete(student.id)} 
                      className="btn-small btn-danger"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
            >
              上一页
            </button>
            <span>第 {page} 页，共 {totalPages} 页</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages}
            >
              下一页
            </button>
          </div>
        </>
      )}

      {/* Edit Modal */}
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
                <label>姓名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>班级</label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                >
                  <option value="">无班级</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.grade} - {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditMode(false)}>取消</button>
                <button type="submit" className="btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importMode && (
        <div className="modal-overlay" onClick={() => setImportMode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入学生</h2>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>导入格式</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      checked={importType === 'json'}
                      onChange={() => setImportType('json')}
                    />
                    JSON
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={importType === 'csv'}
                      onChange={() => setImportType('csv')}
                    />
                    CSV
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>数据内容</label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={10}
                  placeholder={importType === 'json' 
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