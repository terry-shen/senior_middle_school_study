/**
 * 错题重练页面
 *
 * 遮挡答案 → 学生作答 → 揭示对比 → 自评对错
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import MathText from '../components/MathText';
import {
  getWrongQuestionById,
  practiceWrongQuestion,
  normalizeImageUrl,
  parseOptions,
  type StudentWrongQuestion,
} from '../services/wrong-questions-api';
import './WrongQuestionBook.css';

export default function WrongQuestionPractice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const wqId = parseInt(id || '0');

  const [wq, setWq] = useState<StudentWrongQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [myAnswer, setMyAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !wqId) return;
    getWrongQuestionById(token, wqId)
      .then((w) => {
        setWq(w);
        setMyAnswer(w.myAnswer || '');
        setLoading(false);
      })
      .catch((e) => {
        showToast('error', e.message || '加载失败');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wqId, token]);

  const handleSelfAssess = async (result: 'correct' | 'wrong') => {
    if (!token || !wq) return;
    setSubmitting(true);
    try {
      const res = await practiceWrongQuestion(token, wq.id, result, myAnswer);
      if (res.success) {
        showToast(
          'success',
          result === 'correct' ? '已标记为掌握' : '已记录，错次数 +1'
        );
        navigate('/wrong-questions');
      } else {
        showToast('error', '记录失败');
      }
    } catch (e: any) {
      showToast('error', e.message || '记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="wq-loading">加载中...</div>;
  }

  if (!wq) {
    return (
      <div className="wq-loading">
        错题不存在
        <button className="btn btn-secondary" onClick={() => navigate('/wrong-questions')}>
          返回错题本
        </button>
      </div>
    );
  }

  const imgUrl = normalizeImageUrl(wq.imageUrl);
  const options = parseOptions(wq.options);

  return (
    <div className="wq-practice">
      <header className="wq-practice-header">
        <h2>错题重练</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/wrong-questions')}>
          返回错题本
        </button>
      </header>

      <div className="wq-practice-card">
        <div className="wq-practice-content">
          {imgUrl && (
            <div className="wq-practice-image">
              <img src={imgUrl} alt="错题图片" />
            </div>
          )}
          {wq.content && <MathText text={wq.content} />}
          {!imgUrl && !wq.content && (
            <div className="wq-empty-content">尚未补录题面</div>
          )}
          {options.length > 0 && (
            <div className="wq-options">
              {options.map((opt, idx) => (
                <div key={idx} className="wq-option">
                  <span className="option-label">{String.fromCharCode(65 + idx)}.</span>
                  <MathText text={opt} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="wq-practice-answer">
          <label>
            <span>我的答案</span>
            <input
              type="text"
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
              placeholder="输入你的答案"
            />
          </label>

          {!revealed ? (
            <button
              className="btn btn-primary reveal-btn"
              onClick={() => setRevealed(true)}
            >
              揭示答案
            </button>
          ) : (
            <div className="wq-practice-reveal">
              <div className="wq-reveal-row">
                <span className="wq-reveal-label">正确答案：</span>
                <MathText text={wq.correctAnswer || '（未填写）'} />
              </div>
              {wq.analysis && (
                <div className="wq-reveal-analysis">
                  <span className="wq-reveal-label">解析：</span>
                  <MathText text={wq.analysis} />
                </div>
              )}
              <div className="wq-self-assess">
                <span className="wq-self-assess-label">自评：</span>
                <button
                  className="btn btn-success"
                  disabled={submitting}
                  onClick={() => handleSelfAssess('correct')}
                >
                  我答对了
                </button>
                <button
                  className="btn btn-danger"
                  disabled={submitting}
                  onClick={() => handleSelfAssess('wrong')}
                >
                  我答错了
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
