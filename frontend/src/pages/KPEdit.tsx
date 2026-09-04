import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getKpDocument, updateKpDocument } from '../services/knowledge-point-import-api';
import MathText from '../components/MathText';
import './PaperEdit.css';

// MathLive is imported dynamically to avoid SSR issues
let mathliveLoaded = false;
async function loadMathLive() {
  if (!mathliveLoaded) {
    await import('mathlive');
    mathliveLoaded = true;
  }
}

export default function KPEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const docId = parseInt(id || '0');

  const [markdown, setMarkdown] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // MathLive popup state
  const [showMathPopup, setShowMathPopup] = useState(false);
  const [mathFieldValue, setMathFieldValue] = useState('');
  const [isBlockFormula, setIsBlockFormula] = useState(false);
  const mathFieldRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = user?.role === 'admin';

  // Load document
  useEffect(() => {
    if (!token || !docId) return;
    setLoading(true);
    getKpDocument(token, docId)
      .then((doc) => {
        setTitle(doc.name || '');
        const content = doc.contentMarkdown || '';
        setMarkdown(content);
        setPreviewContent(content);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load KP document:', err);
        setLoading(false);
      });
  }, [token, docId]);

  // Load MathLive on mount
  useEffect(() => {
    loadMathLive().catch(console.error);
  }, []);

  // Debounced preview update
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewContent(markdown);
    }, 300);
  }, [markdown]);

  // Auto-save every 60s (admin only)
  useEffect(() => {
    if (!token || !docId || loading || !isAdmin) return;
    autoSaveTimer.current = setInterval(() => {
      handleSave(true);
    }, 60000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [token, docId, loading, markdown, isAdmin]);

  // Save on unmount (admin only)
  useEffect(() => {
    return () => {
      if (token && docId && markdown && isAdmin) {
        updateKpDocument(token, docId, { contentMarkdown: markdown }).catch(console.error);
      }
    };
  }, []);

  const handleSave = useCallback(async (_auto = false) => {
    if (!token || !docId || !isAdmin) return;
    setSaving(true);
    try {
      await updateKpDocument(token, docId, { contentMarkdown: markdown });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [token, docId, markdown, isAdmin]);

  const getCursorPos = (): { start: number; end: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return { start: ta.selectionStart, end: ta.selectionEnd };
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = getCursorPos();
    if (!pos) return;
    const newMarkdown = markdown.substring(0, pos.start) + text + markdown.substring(pos.end);
    setMarkdown(newMarkdown);
    setTimeout(() => {
      ta.focus();
      const newPos = pos.start + text.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const openMathPopup = (block: boolean = false) => {
    setIsBlockFormula(block);
    setMathFieldValue('');
    setShowMathPopup(true);
    setTimeout(() => {
      const mf = document.querySelector('math-field');
      if (mf) {
        mathFieldRef.current = mf as HTMLElement;
        (mf as any).focus();
      }
    }, 100);
  };

  const confirmMathInsert = () => {
    const mf = mathFieldRef.current as any;
    if (!mf) return;
    const latex = mf.value || mathFieldValue;
    const wrapped = isBlockFormula ? `$$${latex}$$` : `$${latex}$`;
    insertAtCursor(wrapped);
    setShowMathPopup(false);
  };

  if (loading) return <div className="paper-edit"><p>加载中...</p></div>;

  return (
    <div className="paper-edit">
      <div className="paper-edit-header">
        <div className="header-left">
          <h2>{title || '知识点文档编辑'}</h2>
          {lastSaved && <span className="save-status">最后保存: {lastSaved.toLocaleTimeString()}</span>}
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/knowledge-points')} className="btn btn-secondary">
            返回列表
          </button>
          {isAdmin && (
            <>
              <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-primary">
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => openMathPopup(false)} className="btn btn-accent">
                插入公式
              </button>
            </>
          )}
        </div>
      </div>

      <div className="paper-edit-tips">
        <p>
          📝 提示：使用 <code>$...$</code> 插入行内公式，<code>$$...$$</code> 插入独立公式。
          支持图片 <code>![](url)</code>、表格、列表等 Markdown 语法。
        </p>
      </div>

      <div className="editor-container">
        <div className="editor-pane">
          <div className="pane-header">
            <span>Markdown 源码 {isAdmin ? '(可编辑)' : '(只读)'}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            readOnly={!isAdmin}
            className="markdown-textarea"
            placeholder="在此输入知识点内容..."
          />
        </div>
        <div className="preview-pane">
          <div className="pane-header">
            <span>预览</span>
          </div>
          <div className="preview-content">
            <MathText text={previewContent} />
          </div>
        </div>
      </div>

      {showMathPopup && (
        <div className="math-popup-overlay" onClick={() => setShowMathPopup(false)}>
          <div className="math-popup" onClick={(e) => e.stopPropagation()}>
            <h3>{isBlockFormula ? '插入独立公式' : '插入行内公式'}</h3>
            {(() => {
              const MathField = 'math-field' as any;
              return (
                <MathField
                  onInput={(e: any) => {
                    const value = e.target?.value || '';
                    setMathFieldValue(value);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: '60px',
                    padding: '12px',
                    fontSize: '20px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    marginBottom: '12px',
                  }}
                />
              );
            })()}
            <div className="popup-actions">
              <button onClick={confirmMathInsert} className="btn btn-primary">确认插入</button>
              <button onClick={() => setShowMathPopup(false)} className="btn btn-secondary">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
