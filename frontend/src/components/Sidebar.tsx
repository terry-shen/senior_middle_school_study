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
    title: '题目管理',
    items: [
      { to: '/questions', label: '题目列表', icon: '📋' },
      { to: '/difficulty', label: '难度管理', icon: '📊' },
    ],
  },
  {
    title: '知识点文档',
    items: [
      { to: '/knowledge-points', label: '知识点列表', icon: '📖' },
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
      { to: '/online-exams', label: '在线测验', icon: '🌐' },
      { to: '/grading', label: 'AI批改', icon: '✏️' },
      { to: '/answer-sheets', label: '答题纸阅卷', icon: '📝' },
    ],
  },
  {
    title: '系统设置',
    items: [
      { to: '/subjects', label: '学科管理', icon: '🗂️' },
      { to: '/models', label: '模型管理', icon: '⚙️' },
    ],
  },
];

const studentItems: NavItem[] = [
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
