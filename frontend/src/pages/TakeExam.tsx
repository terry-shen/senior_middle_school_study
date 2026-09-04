import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MathText from '../components/MathText';
import {
  startExam,
  saveAnswer,
  uploadImageAnswer,
  submitExam,
  getExamRecord,
  getExamQuestions,
  getExamById,
} from '../services/online-exams-api';
import type { ExamQuestion, ExamRecord } from '../services/online-exams-api';
import './TakeExam.css';

export default function TakeExam() {
  const { examId } = useParams<{ examId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [record, setRecord] = useState<ExamRecord | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [imageAnswers, setImageAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExam();
  }, [examId, token]);

  useEffect(() => {
    if (record && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            handleSubmit();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [record, timeLeft]);

  const loadExam = async () => {
    if (!examId || !token) return;

    const examData = await getExamById(parseInt(examId), token);
    if (!examData) {
      alert('测验不存在');
      navigate('/exams');
      return;
    }
    setExam(examData);

    const questionsData = await getExamQuestions(parseInt(examId), token);
    setQuestions(questionsData || []);

    // Check if already started
    const existingRecord = await getExamRecord(parseInt(examId), token);
    if (existingRecord && existingRecord.status === 'in_progress') {
      setRecord(existingRecord);
      const remainingTime = Math.max(
        0,
        examData.duration * 60 - Math.floor((Date.now() - new Date(existingRecord.startTime).getTime()) / 1000)
      );
      setTimeLeft(remainingTime);

      // Load existing answers (getExamRecord already includes record.answers)
      const answerRecords = Array.isArray((existingRecord as any)?.answers)
        ? (existingRecord as any).answers
        : [];
      const answerMap: Record<number, string> = {};
      (answerRecords as Array<{ questionId: number; answer?: string | null }>).forEach((a) => {
        answerMap[a.questionId] = a.answer || '';
      });
      setAnswers(answerMap);
    }

    setLoading(false);
  };

  const handleStart = async () => {
    if (!examId || !token) return;

    const result = await startExam(parseInt(examId), token);
    if (result.record) {
      setRecord(result.record);
      setTimeLeft(exam.duration * 60);
    } else {
      alert(result.error || '无法开始测验');
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleImageUpload = async (questionId: number, file: File) => {
    if (!record || !token) return;

    const result = await uploadImageAnswer(record.id, questionId, file, token);
    if (result.success && result.imageUrl) {
      setImageAnswers((prev) => ({ ...prev, [questionId]: result.imageUrl! }));
      alert('图片上传成功');
    } else {
      alert('上传失败');
    }
  };

  const handleSave = async (questionId: number) => {
    if (!record || !token) return;

    const answer = answers[questionId] || '';
    if (!answer && !imageAnswers[questionId]) {
      alert('请先回答问题');
      return;
    }

    await saveAnswer(record.id, questionId, answer, token);
    alert('答案已保存');
  };

  const handleSubmit = async () => {
    if (!record || !token) return;
    if (submitting) return;

    setSubmitting(true);
    const result = await submitExam(record.id, token);
    if (result.success) {
      alert('测验已提交');
      navigate('/exams');
    } else {
      alert('提交失败');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!record) {
    return (
      <div className="take-exam start-page">
        <h1>{exam?.title}</h1>
        <div className="exam-info">
          <p>题目数量: {questions.length}</p>
          <p>总分: {exam?.totalScore}</p>
          <p>时长: {exam?.duration} 分钟</p>
        </div>
        <button onClick={handleStart} className="btn-start">
          开始答题
        </button>
      </div>
    );
  }

  return (
    <div className="take-exam">
      <div className="exam-header">
        <h1>{exam?.title}</h1>
        <div className="timer">
          剩余时间: <span className={timeLeft < 300 ? 'warning' : ''}>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="question-nav">
        {questions.map((q, index) => (
          <button
            key={q.id}
            className={`nav-btn ${currentQuestion === index ? 'active' : ''} ${answers[q.id] ? 'answered' : ''}`}
            onClick={() => setCurrentQuestion(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="question-container">
          <div className="question-header">
            <h2>
              第 {currentQuestion + 1} 题 ({questions[currentQuestion].score} 分)
            </h2>
            <span className="question-type">
              {questions[currentQuestion].questionType === 'choice'
                ? '选择题'
                : questions[currentQuestion].questionType === 'fill'
                ? '填空题'
                : '解答题'}
            </span>
          </div>

          <div className="question-content">
            <p><MathText text={questions[currentQuestion].content} /></p>
          </div>

          {questions[currentQuestion].questionType === 'choice' && questions[currentQuestion].options && (
            <div className="options">
              {questions[currentQuestion].options!.map((option, index) => (
                <label key={index} className="option">
                  <input
                    type="radio"
                    name={`question-${questions[currentQuestion].id}`}
                    value={String.fromCharCode(65 + index)}
                    checked={answers[questions[currentQuestion].id] === String.fromCharCode(65 + index)}
                    onChange={() =>
                      handleAnswerChange(questions[currentQuestion].id, String.fromCharCode(65 + index))
                    }
                  />
                  <span>
                    {String.fromCharCode(65 + index)}. <MathText text={option} />
                  </span>
                </label>
              ))}
            </div>
          )}

          {questions[currentQuestion].questionType === 'fill' && (
            <div className="fill-input">
              <input
                type="text"
                value={answers[questions[currentQuestion].id] || ''}
                onChange={(e) => handleAnswerChange(questions[currentQuestion].id, e.target.value)}
                placeholder="填写答案"
              />
            </div>
          )}

          {questions[currentQuestion].questionType === 'essay' && (
            <div className="essay-input">
              <textarea
                value={answers[questions[currentQuestion].id] || ''}
                onChange={(e) => handleAnswerChange(questions[currentQuestion].id, e.target.value)}
                placeholder="写出详细解答过程..."
              />
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files && handleImageUpload(questions[currentQuestion].id, e.target.files[0])}
                />
                <label className="upload-hint">点击拍照或选择图片上传</label>
                {imageAnswers[questions[currentQuestion].id] && (
                  <img src={imageAnswers[questions[currentQuestion].id]} alt="答案图片" />
                )}
              </div>
            </div>
          )}

          <div className="question-actions">
            <button onClick={() => handleSave(questions[currentQuestion].id)} className="btn-save">
              保存答案
            </button>
            {currentQuestion > 0 && (
              <button onClick={() => setCurrentQuestion(currentQuestion - 1)} className="btn-nav">
                上一题
              </button>
            )}
            {currentQuestion < questions.length - 1 && (
              <button onClick={() => setCurrentQuestion(currentQuestion + 1)} className="btn-nav">
                下一题
              </button>
            )}
          </div>
        </div>
      )}

      <div className="submit-section">
        <button onClick={handleSubmit} disabled={submitting} className="btn-submit">
          {submitting ? '提交中...' : '提交试卷'}
        </button>
      </div>
    </div>
  );
}