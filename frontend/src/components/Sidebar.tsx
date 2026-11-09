import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SubjectSwitcher from './SubjectSwitcher';
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
    title: '试卷管理',
    items: [
      { to: '/paper-library', label: '试卷库', icon: '📚' },
      { to: '/question-bank', label: '题库管理', icon: '✂️' },
    ],
  },
  {
    title: '学习内容',
    items: [
      { to: '/learning', label: '章节学习', icon: '📖' },
      { to: '/netdisk-index', label: '资源映射', icon: '🧭' },
      { to: '/chapters', label: '章节管理', icon: '🗂️' },
    ],
  },
  {
    title: '题目管理',
    items: [
      { to: '/questions', label: '题目列表', icon: '📋' },
    ],
  },
  {
    title: '学生管理',
    items: [
      { to: '/students', label: '学生列表', icon: '👥' },
      { to: '/incentive', label: '学习激励', icon: '🎖️' },
    ],
  },
  {
    title: '考试管理',
    items: [
      { to: '/mock-exams', label: '模拟考试', icon: '🎯' },
  { to: '/resources', label: '学习资源', icon: '📺' },
      { to: '/answer-sheets', label: '答题纸阅卷', icon: '📝' },
    ],
  },
  {
    title: '系统设置',
    items: [
      { to: '/subjects', label: '学科管理', icon: '🗂️' },
      { to: '/settings/netdisk', label: '网盘绑定', icon: '☁️' },
      { to: '/resources/manage', label: '资源管理', icon: '🎛️' },
      { to: '/models', label: '模型管理', icon: '⚙️' },
    ],
  },
];

const studentItems: NavItem[] = [
  { to: '/learning', label: '章节学习', icon: '📖' },
  { to: '/mock-exams', label: '模拟考试', icon: '🎯' },
  { to: '/wrong-questions', label: '错题本', icon: '❌' },
  { to: '/answer-sheets', label: '我的答题纸', icon: '📝' },
  { to: '/incentive', label: '学习激励', icon: '🎖️' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavigate = () => {
    onClose();
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" onClick={handleNavigate} className="sidebar-logo">
            📐 高中学习系统
          </Link>
        </div>

        <SubjectSwitcher />

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-item ${isActive('/') ? 'active' : ''}`}
            onClick={handleNavigate}
          >
            🏠 工作台
          </Link>

          <Link
            to="/ai-assistants"
            className={`sidebar-item ${isActive('/ai-assistants') ? 'active' : ''}`}
            onClick={handleNavigate}
          >
            <span className="sidebar-item-icon">🤖</span>
            <span>AI 助理</span>
          </Link>

          {user?.role === 'admin' ? (
            adminGroups.map((group) => (
              <div key={group.title} className="sidebar-group">
                <div className="sidebar-group-title">{group.title}</div>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`sidebar-item ${isActive(item.to) ? 'active' : ''}`}
                    onClick={handleNavigate}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))
          ) : (
            studentItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-item ${isActive(item.to) ? 'active' : ''}`}
                onClick={handleNavigate}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))
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
