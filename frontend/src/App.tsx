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
const ModelManagement = lazy(() => import('./components/ModelManagement'));
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const AdminWrongQuestionView = lazy(() => import('./pages/AdminWrongQuestionView'));
const PaperLibrary = lazy(() => import('./pages/PaperLibrary'));
const ChapterManagement = lazy(() => import('./pages/ChapterManagement'));
const ChapterMap = lazy(() => import('./pages/ChapterMap'));
const ChapterDetail = lazy(() => import('./pages/ChapterDetail'));
const NetdiskMapping = lazy(() => import('./pages/NetdiskMapping'));
const PaperViewer = lazy(() => import('./pages/PaperViewer'));
const QuestionBank = lazy(() => import('./pages/QuestionBank'));
const PaperEdit = lazy(() => import('./pages/PaperEdit'));
const SplitPreview = lazy(() => import('./pages/SplitPreview'));
const QuestionList = lazy(() => import('./pages/QuestionList'));
const GradingReview = lazy(() => import('./pages/GradingReview'));
const WrongQuestionBook = lazy(() => import('./pages/WrongQuestionBook'));
const WrongQuestionEdit = lazy(() => import('./pages/WrongQuestionEdit'));
const WrongQuestionPractice = lazy(() => import('./pages/WrongQuestionPractice'));
const WrongQuestionPrint = lazy(() => import('./pages/WrongQuestionPrint'));
const MockExamPage = lazy(() => import('./pages/MockExam'));
const LearningIncentive = lazy(() => import('./pages/LearningIncentive'));
  const AnswerSheetsList = lazy(() => import('./pages/AnswerSheetsList'));
  const AnswerSheetDetail = lazy(() => import('./pages/AnswerSheetDetail'));
  const SubjectManagement = lazy(() => import('./pages/SubjectManagement'));
const NetdiskBinding = lazy(() => import('./pages/NetdiskBinding'));
const VideoLibrary = lazy(() => import('./pages/VideoLibrary'));
const VideoManagement = lazy(() => import('./pages/VideoManagement'));

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
        path="/admin/students/:id/wrong-questions"
        element={
          <ProtectedRoute requireAdmin>
            <AdminWrongQuestionView />
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
        path="/paper-library/:id/view"
        element={
          <ProtectedRoute>
            <PaperViewer />
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
        path="/netdisk-index"
        element={
          <ProtectedRoute requireAdmin>
            <NetdiskMapping />
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
        path="/exams"
        element={<Navigate to="/mock-exams" replace />}
      />
      <Route
        path="/online-exams"
        element={<Navigate to="/mock-exams" replace />}
      />
      <Route
        path="/take-exam/:examId"
        element={<Navigate to="/mock-exams" replace />}
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
        path="/subjects"
        element={
          <ProtectedRoute requireAdmin>
            <SubjectManagement />
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
          <ProtectedRoute>
            <VideoLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources/manage"
        element={
          <ProtectedRoute requireAdmin>
            <VideoManagement />
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
