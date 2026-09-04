import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export default function Login() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(studentId, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '登录失败');
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>高中数学学习系统</h1>
        <h2>学生登录</h2>
        
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
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="请输入密码"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <div className="auth-links">
          <p>
            还没有账号？<Link to="/register">立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}