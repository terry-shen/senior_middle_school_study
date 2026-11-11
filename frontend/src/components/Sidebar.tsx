import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getLearningSubjects, type LearningSubject } from '../services/learning-api';
import './Sidebar.css';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const adminGroups: NavGroup[] = [
  {
    title: '学习内容',
    items: [
      { to: '/chapters', label: '章节管理', icon: '🗂️' },
      { to: '/netdisk-index', label: '资源映射', icon: '🧭' },
      { to: '/resources', label: '学习资源', icon: '📺' },
    ],
  },
  {
    title: '学生管理',
    items: [{ to: '/students', label: '学生列表', icon: '👥' }],
  },
  {
    title: '系统设置',
    items: [{ to: '/settings/netdisk', label: '网盘绑定', icon: '☁️' }],
  },
];

const studentItems: NavItem[] = [{ to: '/ai-assistants', label: 'AI 助理', icon: '🤖' }];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getLearningSubjects(token)
      .then((res) => {
        if (!cancelled) {
          // 已建设学科（有教材小节）排在前面，待建设学科统一排在后面，各自保持原相对顺序
          const list = [...(res.data ?? [])];
          list.sort((a, b) => {
            const ra = a.sectionCount > 0 ? 0 : 1;
            const rb = b.sectionCount > 0 ? 0 : 1;
            return ra - rb;
          });
          setSubjects(list);
        }
      })
      .catch(() => {
        /* 学科列表加载失败不影响其他导航 */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleNavigate = () => {
    onClose();
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/login');
  };

  const renderItem = (item: NavItem) => (
    <Link
      key={item.to}
      to={item.to}
      className={`sidebar-item ${isActive(item.to) ? 'active' : ''}`}
      onClick={handleNavigate}
    >
      <span className="sidebar-item-icon">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" onClick={handleNavigate} className="sidebar-logo">
            📐 高中学习系统
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-item ${isActive('/') ? 'active' : ''}`}
            onClick={handleNavigate}
          >
            🏠 工作台
          </Link>

          {subjects.length > 0 && (
            <div className="sidebar-group">
              <div className="sidebar-group-title">学科</div>
              {subjects.map((s) => {
                const ready = s.sectionCount > 0;
                const to = `/learning/${s.code}`;
                if (!ready) {
                  return (
                    <span key={s.id} className="sidebar-item sidebar-item-disabled" title={`${s.name} · 待建设`}>
                      <span className="sidebar-item-icon">{s.icon || '📘'}</span>
                      <span>{s.name}</span>
                      <span className="sidebar-item-tag">待建设</span>
                    </span>
                  );
                }
                return (
                  <Link
                    key={s.id}
                    to={to}
                    className={`sidebar-item ${isActive(to) ? 'active' : ''}`}
                    onClick={() => {
                      localStorage.setItem('learningSubjectCode', s.code);
                      localStorage.setItem('learningSubjectId', String(s.id));
                      handleNavigate();
                    }}
                  >
                    <span className="sidebar-item-icon">{s.icon || '📘'}</span>
                    <span>{s.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {user?.role === 'admin' ? (
            adminGroups.map((group) => (
              <div key={group.title} className="sidebar-group">
                <div className="sidebar-group-title">{group.title}</div>
                {group.items.map(renderItem)}
              </div>
            ))
          ) : (
            studentItems.map(renderItem)
          )}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">
                {user.role === 'admin' ? '管理员' : '学生'}
              </span>
            </div>
          )}
          <button onClick={handleLogout} className="sidebar-logout">
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}
