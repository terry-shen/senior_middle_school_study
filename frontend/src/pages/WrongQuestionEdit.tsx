/**
 * 错题编辑/补录页面
 *
 * 复用 PaperEdit 的 MathLive + textarea dual-pane 模式：
 * - 左栏 Markdown 源码 textarea + MathLive 公式插入按钮
 * - 右栏 MathText 实时预览
 * - 元数据表单（题型/难度/知识点标签/我的答案/正确答案/解析/笔记）
 * - 选择题选项编辑（A/B/C/D）
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import MathText from '../components/MathText';
import {
  getWrongQuestionById,
  updateWrongQuestion,
  createManualWrongQuestion,
  normalizeImageUrl,
  parseOptions,
  type StudentWrongQuestion,
} from '../services/wrong-questions-api';
import './WrongQuestionBook.css';

let mathliveLoaded = false;
async function loadMathLive() {
  if (!mathliveLoaded) {
    await import('mathlive');
    mathliveLoaded = true;
  }
}

const TYPE_OPTIONS = [
  { value: 'unknown', label: '未分类' },
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'fill', label: '填空题' },
  { value: 'essay', label: '解答题' },
];

const DIFF_OPTIONS = [
  { value: 'unknown', label: '未设置' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '较难' },
  { value: 'very_hard', label: '困难' },
];

function isChoice(t: string) {
  return t === 'single_choice' || t === 'multiple_choice' || t === 'choice';
}

export default function WrongQuestionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const wqId = id ? parseInt(id) : 0;
  const isNew = !wqId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [content, setContent] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [questionType, setQuestionType] = useState('unknown');
  const [difficulty, setDifficulty] = useState('unknown');
  const [knowledgePointTags, setKnowledgePointTags] = useState('');
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);

  // MathLive popup state
  const [showMathPopup, setShowMathPopup] = useState(false);
  const [mathFieldValue, setMathFieldValue] = useState('');
  const [isBlockFormula, setIsBlockFormula] = useState(false);
  const [mathTarget, setMathTarget] = useState<'content' | 'analysis'>('content');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMathLive().catch(console.error);
  }, []);

  useEffect(() => {
    if (isNew || !token || !wqId) return;
    setLoading(true);
    getWrongQuestionById(token, wqId)
      .then((w: StudentWrongQuestion) => {
        setImageUrl(normalizeImageUrl(w.imageUrl));
        setContent(w.content || '');
        setMyAnswer(w.myAnswer || '');
        setCorrectAnswer(w.correctAnswer || '');
        setAnalysis(w.analysis || '');
        setQuestionType(w.questionType || 'unknown');
        setDifficulty(w.difficulty || 'unknown');
        setKnowledgePointTags(w.knowledgePointTags || '');
        setNotes(w.notes || '');
        const parsed = parseOptions(w.options);
        setOptions(
          parsed.length > 0 ? parsed : ['', '', '', '']
        );
        setLoading(false);
      })
      .catch((e) => {
        showToast('error', e.message || '加载失败');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wqId, token]);

  const insertFormula = () => {
    const tex = isBlockFormula ? `$${mathFieldValue}$$` : `$${mathFieldValue}$`;
    if (mathTarget === 'analysis') {
      setAnalysis((prev) => (prev ? `${prev} ${tex}` : tex));
    } else {
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const next = content.slice(0, start) + tex + content.slice(end);
        setContent(next);
        setTimeout(() => {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = start + tex.length;
        }, 0);
      } else {
        setContent((prev) => `${prev}${tex}`);
      }
    }
    setShowMathPopup(false);
    setMathFieldValue('');
  };

  const handleSave = async () => {
    if (!token) return;
    if (!content.trim() && !imageUrl) {
      showToast('error', '请填写题面内容');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        content,
        myAnswer,
        correctAnswer,
        analysis,
        questionType,
        difficulty,
        knowledgePointTags,
        notes,
      };
      if (isChoice(questionType)) {
        const validOptions = options.filter((o) => o.trim());
        payload.options = validOptions.length > 0 ? JSON.stringify(validOptions) : null;
      } else {
        payload.options = null;
      }

      if (isNew) {
        const result = await createManualWrongQuestion(token, payload);
        if (result.success) {
          showToast('success', '错题已创建');
          navigate('/wrong-questions');
        } else {
          showToast('error', '创建失败');
        }
      } else {
        const result = await updateWrongQuestion(token, wqId, payload);
        if (result.success) {
          showToast('success', '已保存');
          navigate('/wrong-questions');
        } else {
          showToast('error', '保存失败');
        }
      }
    } catch (e: any) {
      showToast('error', e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="wq-loading">加载中...</div>;
  }

  return (
    <div className="wrong-question-edit">
      <header className="wq-edit-header">
        <h2>{isNew ? '手动录入错题' : '编辑错题'}</h2>
        <div className="wq-edit-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/wrong-questions')}>
            返回
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>

      {imageUrl && (
        <div className="wq-edit-image">
          <img src={imageUrl} alt="错题图片" />
          <div className="wq-edit-image-hint">原图保留，补录的题面显示在下方</div>
        </div>
      )}

      <div className="wq-edit-dual">
        <div className="wq-edit-pane">
          <div className="wq-edit-pane-header">
            <span>题面（支持 LaTeX 公式）</span>
            <div className="wq-formula-buttons">
              <button
                className="btn-mini"
                onClick={() => {
                  setMathTarget('content');
                  setIsBlockFormula(false);
                  setShowMathPopup(true);
                }}
              >
                行内公式
              </button>
              <button
                className="btn-mini"
                onClick={() => {
                  setMathTarget('content');
                  setIsBlockFormula(true);
                  setShowMathPopup(true);
                }}
              >
                独立公式
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="wq-edit-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入题面内容，可用 $...$ 书写 LaTeX 公式"
          />
        </div>

        <div className="wq-edit-pane">
          <div className="wq-edit-pane-header">
            <span>预览</span>
          </div>
          <div className="wq-edit-preview">
            <MathText text={content} />
          </div>
        </div>
      </div>

      {isChoice(questionType) && (
        <div className="wq-edit-options">
          <div className="wq-edit-section-title">选项（选择题必填）</div>
          {options.map((opt, idx) => (
            <div key={idx} className="wq-edit-option-row">
              <span className="option-label">{String.fromCharCode(65 + idx)}.</span>
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[idx] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容`}
              />
            </div>
          ))}
          <div className="wq-edit-option-actions">
            <button className="btn-mini" onClick={() => setOptions([...options, ''])}>
              + 添加选项
            </button>
            {options.length > 2 && (
              <button
                className="btn-mini danger"
                onClick={() => setOptions(options.slice(0, -1))}
              >
                - 删除末项
              </button>
            )}
          </div>
        </div>
      )}

      <div className="wq-edit-meta">
        <div className="wq-edit-section-title">元数据</div>
        <div className="wq-edit-meta-grid">
          <label>
            <span>题型</span>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>难度</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFF_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>知识点标签（逗号分隔）</span>
            <input
              type="text"
              value={knowledgePointTags}
              onChange={(e) => setKnowledgePointTags(e.target.value)}
              placeholder="如：导数,三角函数"
            />
          </label>
        </div>
      </div>

      <div className="wq-edit-answers">
        <div className="wq-edit-answer-row">
          <label>
            <span>我的答案</span>
            <input
              type="text"
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
            />
          </label>
          <label>
            <span>正确答案</span>
            <input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
            />
          </label>
        </div>
        <div className="wq-edit-answer-block">
          <div className="wq-edit-pane-header">
            <span>解析</span>
            <button
              className="btn-mini"
              onClick={() => {
                setMathTarget('analysis');
                setIsBlockFormula(false);
                setShowMathPopup(true);
              }}
            >
              插入公式
            </button>
          </div>
          <textarea
            className="wq-edit-analysis"
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="输入解析内容"
          />
          {analysis && (
            <div className="wq-edit-analysis-preview">
              <MathText text={analysis} />
            </div>
          )}
        </div>
        <label className="wq-edit-notes">
          <span>笔记</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="个人笔记"
          />
        </label>
      </div>

      {showMathPopup && (
        <div className="math-popup-overlay" onClick={() => setShowMathPopup(false)}>
          <div className="math-popup" onClick={(e) => e.stopPropagation()}>
            <div className="math-popup-header">
              <h3>{isBlockFormula ? '插入独立公式' : '插入行内公式'}</h3>
              <button className="popup-close" onClick={() => setShowMathPopup(false)}>
                ✕
              </button>
            </div>
            <div className="math-popup-body">
              <p className="math-popup-hint">
                在下方输入公式（支持键盘与虚拟键盘），确认后插入到
                {mathTarget === 'content' ? '题面' : '解析'}
              </p>
              {(() => {
                const MathField = 'math-field' as any;
                return (
                  <MathField
                    onInput={(e: any) => setMathFieldValue(e.target?.value || '')}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      fontSize: '20px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  />
                );
              })()}
              <div className="math-popup-preview">
                <strong>LaTeX 输出：</strong>
                <code>
                  {isBlockFormula ? `$$${mathFieldValue}$$` : `$${mathFieldValue}$`}
                </code>
              </div>
            </div>
            <div className="math-popup-footer">
              <button className="btn btn-secondary" onClick={() => setShowMathPopup(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={insertFormula}>
                确认插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
