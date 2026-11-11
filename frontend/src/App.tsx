import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SubjectProvider } from './contexts/SubjectContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';
import Sidebar from './components/Sidebar';
import Workbench from './pages/Workbench';

// Lazy-loaded pages for code splitting
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const ChapterManagement = lazy(() => import('./pages/ChapterManagement'));
const ChapterMap = lazy(() => import('./pages/ChapterMap'));
const ChapterDetail = lazy(() => import('./pages/ChapterDetail'));
const AiAssistants = lazy(() => import('./pages/AiAssistants'));
const NetdiskMapping = lazy(() => import('./pages/NetdiskMapping'));
const NetdiskBinding = lazy(() => import('./pages/NetdiskBinding'));
const VideoLibrary = lazy(() => import('./pages/VideoLibrary'));

function LearningRedirect() {
  const code = localStorage.getItem('learningSubjectCode') || 'math';
  return <Navigate to={`/learning/${code}`} replace />;
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
            <Workbench />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chapters"
        element={
          <ProtectedRoute requireAdmin>
            <ChapterManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning"
        element={
          <ProtectedRoute>
            <LearningRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning/:code"
        element={
          <ProtectedRoute>
            <ChapterMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning/section/:id"
        element={
          <ProtectedRoute>
            <ChapterDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-assistants"
        element={
          <ProtectedRoute>
            <AiAssistants />
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
        path="/netdisk-index"
        element={
          <ProtectedRoute requireAdmin>
            <NetdiskMapping />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/netdisk"
        element={
          <ProtectedRoute requireAdmin>
            <NetdiskBinding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources"
        element={
          <ProtectedRoute requireAdmin>
            <VideoLibrary />
          </ProtectedRoute>
        }
      />

      {/* 已下线的试卷 / 题库 / 考试 / 答题纸 / 错题本 / 激励 / 学科管理入口统一回到章节学习 */}
      <Route path="/paper-library/*" element={<Navigate to="/learning" replace />} />
      <Route path="/papers/*" element={<Navigate to="/learning" replace />} />
      <Route path="/question-bank" element={<Navigate to="/learning" replace />} />
      <Route path="/questions" element={<Navigate to="/learning" replace />} />
      <Route path="/exams" element={<Navigate to="/learning" replace />} />
      <Route path="/online-exams" element={<Navigate to="/learning" replace />} />
      <Route path="/take-exam/*" element={<Navigate to="/learning" replace />} />
      <Route path="/grading" element={<Navigate to="/learning" replace />} />
      <Route path="/answer-sheets/*" element={<Navigate to="/learning" replace />} />
      <Route path="/mock-exams" element={<Navigate to="/learning" replace />} />
      <Route path="/wrong-questions/*" element={<Navigate to="/learning" replace />} />
      <Route path="/admin/students/*" element={<Navigate to="/students" replace />} />
      <Route path="/incentive" element={<Navigate to="/learning" replace />} />
      <Route path="/subjects" element={<Navigate to="/learning" replace />} />
      <Route path="/models" element={<Navigate to="/learning" replace />} />
      <Route path="/resources/manage" element={<Navigate to="/resources" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {isAuthenticated && (
        <>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <button
            className="sidebar-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="菜单"
          >
            ☰
          </button>
        </>
      )}
      <main className="main-content">
        <AppRoutes />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubjectProvider>
          <ToastProvider>
            <ErrorBoundary>
              <div className="app">
                <Suspense fallback={<LoadingSpinner />}>
                  <AppContent />
                </Suspense>
              </div>
            </ErrorBoundary>
          </ToastProvider>
        </SubjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
