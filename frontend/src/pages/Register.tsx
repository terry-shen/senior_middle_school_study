import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, getClasses } from '../services/auth-api';
import './Auth.css';

interface ClassInfo {
  id: number;
  name: string;
  grade: string;
}

export default function Register() {
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Load classes for dropdown
    getClasses()
      .then(setClasses)
      .catch(() => setError('无法加载班级列表'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }

    if (!classId) {
      setError('请选择班级');
      return;
    }

    setLoading(true);

    const result = await register(studentId, name, password, parseInt(classId));
    
    if (result.success) {
      navigate('/login', { state: { message: '注册成功，请登录' } });
    } else {
      setError(result.error || '注册失败');
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>高中数学学习系统</h1>
        <h2>学生注册</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="studentId">学号</label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              placeholder="请输入学号"
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="name">姓名</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="请输入姓名"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="classId">班级</label>
            <select
              id="classId"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
            >
              <option value="">请选择班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.grade} - {cls.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="至少6个字符"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="再次输入密码"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        
        <div className="auth-links">
          <p>
            已有账号？<Link to="/login">立即登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}