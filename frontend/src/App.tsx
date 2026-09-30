import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

// Lazy-loaded pages for code splitting
const ModelManagement = lazy(() => import('./components/ModelManagement'));
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const KnowledgePointManagement = lazy(() => import('./pages/KnowledgePointManagement'));
const KnowledgePointImport = lazy(() => import('./pages/KnowledgePointImport'));
const PaperLibrary = lazy(() => import('./pages/PaperLibrary'));
const QuestionBank = lazy(() => import('./pages/QuestionBank'));
const PaperEdit = lazy(() => import('./pages/PaperEdit'));
const SplitPreview = lazy(() => import('./pages/SplitPreview'));
const QuestionList = lazy(() => import('./pages/QuestionList'));
const KPEdit = lazy(() => import('./pages/KPEdit'));
const DifficultyManagement = lazy(() => import('./pages/DifficultyManagement'));
const ExamGeneration = lazy(() => import('./pages/ExamGeneration'));
const OnlineExamManagement = lazy(() => import('./pages/OnlineExamManagement'));
const TakeExam = lazy(() => import('./pages/TakeExam'));
const GradingReview = lazy(() => import('./pages/GradingReview'));
const WrongQuestionBook = lazy(() => import('./pages/WrongQuestionBook'));
const WrongQuestionEdit = lazy(() => import('./pages/WrongQuestionEdit'));
const WrongQuestionPractice = lazy(() => import('./pages/WrongQuestionPractice'));
const WrongQuestionPrint = lazy(() => import('./pages/WrongQuestionPrint'));
const MockExamPage = lazy(() => import('./pages/MockExam'));
const LearningIncentive = lazy(() => import('./pages/LearningIncentive'));
const AnswerSheetsList = lazy(() => import('./pages/AnswerSheetsList'));
const AnswerSheetDetail = lazy(() => import('./pages/AnswerSheetDetail'));

function Home() {
  const { user, logout } = useAuth();

  const adminFeatures = [
    { icon: '📚', title: '学生管理', desc: '管理学生账号和班级', link: '/students' },
    { icon: '📚', title: '试卷库', desc: '整卷导入/分类/发布考试', link: '/paper-library' },
    { icon: '✂️', title: '题库管理', desc: '拆分导入/编辑校准/入库', link: '/question-bank' },
    { icon: '📊', title: '难度管理', desc: 'AI驱动的难度评估', link: '/difficulty' },
    { icon: '📝', title: '自动出卷', desc: '智能组卷生成试卷', link: '/exams' },
    { icon: '🎯', title: '模拟考试', desc: '限时模拟考试场景', link: '/mock-exams' },
    { icon: '🌐', title: '在线测验', desc: '发布和管理在线测验', link: '/online-exams' },
    { icon: '✏️', title: 'AI批改', desc: '自动批改与人工审核', link: '/grading' },
    { icon: '⚙️', title: '模型管理', desc: '配置大语言模型', link: '/models' },
  ];

  const studentFeatures = [
    { icon: '🌐', title: '在线测验', desc: '参加老师布置的测验', link: '/online-exams' },
    { icon: '❌', title: '错题本', desc: '复习错题，针对性提升', link: '/wrong-questions' },
    { icon: '🏆', title: '模拟考试', desc: '限时模拟，对标真实考试', link: '/mock-exams' },
    { icon: '🎖️', title: '学习激励', desc: '徽章、打卡、排行榜', link: '/incentive' },
  ];

  const features = user?.role === 'admin' ? adminFeatures : studentFeatures;

  return (
    <div className="home">
      <div className="home-hero">
        <h2>欢迎使用高中数学学习系统</h2>
        <p>基于AI的数学学习辅助系统，帮助学生提升数学知识点掌握度，提高成绩。</p>
      </div>

      {user && (
        <div className="user-info">
          <p>欢迎，<strong>{user.name}</strong>（{user.role === 'admin' ? '管理员' : '学生'}）</p>
          <button onClick={logout} className="btn btn-secondary">退出登录</button>
        </div>
      )}

      <div className="features">
        {features.map((f) => (
          <Link to={f.link} key={f.link} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface NavDropdownProps {
  title: string;
  links: { to: string; label: string }[];
}

function NavDropdown({ title, links }: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="nav-dropdown"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="nav-dropdown-toggle" onClick={() => setOpen(!open)}>
        {title} <span className="dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="nav-dropdown-menu">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-dropdown-item"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/models"
        element={
          <ProtectedRoute requireAdmin>
            <ModelManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute requireAdmin>
            <StudentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-points"
        element={
          <ProtectedRoute>
            <KnowledgePointManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-points/import"
        element={
          <ProtectedRoute requireAdmin>
            <KnowledgePointImport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-points/:id/edit"
        element={
          <ProtectedRoute>
            <KPEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paper-library"
        element={
          <ProtectedRoute>
            <PaperLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/question-bank"
        element={
          <ProtectedRoute requireAdmin>
            <QuestionBank />
          </ProtectedRoute>
        }
      />
      <Route
        path="/papers"
        element={<Navigate to="/question-bank" replace />}
      />
      <Route
        path="/papers/import-whole"
        element={<Navigate to="/paper-library" replace />}
      />
      <Route
        path="/papers/:id/edit"
        element={
          <ProtectedRoute requireAdmin>
            <PaperEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/papers/:id/split-preview"
        element={
          <ProtectedRoute requireAdmin>
            <SplitPreview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/questions"
        element={
          <ProtectedRoute requireAdmin>
            <QuestionList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/difficulty"
        element={
          <ProtectedRoute requireAdmin>
            <DifficultyManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams"
        element={
          <ProtectedRoute requireAdmin>
            <ExamGeneration />
          </ProtectedRoute>
        }
      />
      <Route
        path="/online-exams"
        element={
          <ProtectedRoute>
            <OnlineExamManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/take-exam/:examId"
        element={
          <ProtectedRoute>
            <TakeExam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grading"
        element={
          <ProtectedRoute requireAdmin>
            <GradingReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/answer-sheets"
        element={
          <ProtectedRoute>
            <AnswerSheetsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/answer-sheets/:id"
        element={
          <ProtectedRoute>
            <AnswerSheetDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-questions"
        element={
          <ProtectedRoute>
            <WrongQuestionBook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-questions/edit/:id"
        element={
          <ProtectedRoute>
            <WrongQuestionEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-questions/edit"
        element={
          <ProtectedRoute>
            <WrongQuestionEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-questions/practice/:id"
        element={
          <ProtectedRoute>
            <WrongQuestionPractice />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-questions/print"
        element={
          <ProtectedRoute>
            <WrongQuestionPrint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mock-exams"
        element={
          <ProtectedRoute>
            <MockExamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incentive"
        element={
          <ProtectedRoute>
            <LearningIncentive />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminLinks = [
    { to: '/students', label: '学生管理' },
    { to: '/paper-library', label: '试卷库' },
    { to: '/question-bank', label: '题库管理' },
    { to: '/difficulty', label: '难度管理' },
    { to: '/exams', label: '自动出卷' },
    { to: '/mock-exams', label: '模拟考试' },
    { to: '/online-exams', label: '在线测验' },
    { to: '/grading', label: 'AI批改' },
    { to: '/answer-sheets', label: '答题纸阅卷' },
    { to: '/models', label: '模型管理' },
  ];

  const studentLinks = [
    { to: '/online-exams', label: '在线测验' },
    { to: '/wrong-questions', label: '错题本' },
    { to: '/mock-exams', label: '模拟考试' },
    { to: '/answer-sheets', label: '我的答题纸' },
    { to: '/incentive', label: '学习激励' },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {isAuthenticated && (
        <header className="app-header">
          <div className="header-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="菜单"
            >
              ☰
            </button>
            <h1>📐 高中数学学习系统</h1>
          </div>
          <nav className={`app-nav ${mobileMenuOpen ? 'open' : ''}`}>
            <Link
              to="/"
              className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              首页
            </Link>
            <Link
              to="/knowledge-points"
              className={location.pathname === '/knowledge-points' ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              知识点
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/knowledge-points/import"
                className={location.pathname === '/knowledge-points/import' ? 'nav-link active' : 'nav-link'}
                onClick={closeMobileMenu}
              >
                知识点导入
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/questions"
                className={location.pathname === '/questions' ? 'nav-link active' : 'nav-link'}
                onClick={closeMobileMenu}
              >
                题目列表
              </Link>
            )}
            {user?.role === 'admin' && (
              <>
                <NavDropdown title="管理" links={adminLinks} />
                <Link
                  to="/wrong-questions"
                  className={location.pathname === '/wrong-questions' ? 'nav-link active' : 'nav-link'}
                  onClick={closeMobileMenu}
                >
                  错题本
                </Link>
                <Link
                  to="/incentive"
                  className={location.pathname === '/incentive' ? 'nav-link active' : 'nav-link'}
                  onClick={closeMobileMenu}
                >
                  学习激励
                </Link>
              </>
            )}
            {user?.role === 'student' && (
              <NavDropdown title="学习" links={studentLinks} />
            )}
            <button onClick={logout} className="btn-logout">退出</button>
          </nav>
        </header>
      )}

      <main className="app-main">
        <AppRoutes />
      </main>

      {isAuthenticated && (
        <footer className="app-footer">
          <p>© 2026 高中数学学习系统 - Powered by AI</p>
        </footer>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <div className="app">
              <Suspense fallback={<LoadingSpinner />}>
                <AppContent />
              </Suspense>
            </div>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
