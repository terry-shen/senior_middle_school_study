import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPaper, saveMarkdown, getDownloadSourceUrl } from '../services/papers-api';
import type { ExamPaper } from '../services/papers-api';
import MathText from '../components/MathText';
import './PaperEdit.css';

/**
 * MathLive-enhanced Paper Editor
 *
 * Features:
 * - Plain text editor (textarea) with Markdown source — user sees the actual content
 * - MathLive formula inserter: click "插入公式" → MathLive mathfield popup → confirm → $latex$ inserted at cursor
 * - Real-time MathText (KaTeX) preview on right pane
 * - Question tags (<!--QN_START-->) visible in source, hidden in preview
 * - Auto-save every 60s + save on unmount
 * - Source file download
 * - Tag count badge in header
 */

// MathLive is imported dynamically to avoid SSR issues
let mathliveLoaded = false;
async function loadMathLive() {
  if (!mathliveLoaded) {
    await import('mathlive');
    mathliveLoaded = true;
  }
}

export default function PaperEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const paperId = parseInt(id || '0');

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

  // Count tags from markdown
  const tagCount = (markdown.match(/<!--Q\d+_START-->/g) || []).length;

  // Load paper data
  useEffect(() => {
    if (!token || !paperId) return;
    setLoading(true);
    getPaper(token, paperId)
      .then((paper: ExamPaper) => {
        setTitle(paper.title || '');
        const content = paper.editedMarkdown || paper.parsedMarkdown || paper.rawContent || '';
        setMarkdown(content);
        setPreviewContent(content);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load paper:', err);
        setLoading(false);
      });
  }, [token, paperId]);

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

  // Auto-save every 60s
  useEffect(() => {
    if (!token || !paperId || loading) return;
    autoSaveTimer.current = setInterval(() => {
      handleSave(true);
    }, 60000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [token, paperId, loading, markdown]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (token && paperId && markdown) {
        saveMarkdown(token, paperId, markdown).catch(console.error);
      }
    };
  }, []);

  // Save handler
  const handleSave = useCallback(async (auto = false) => {
    if (!token || !paperId) return;
    setSaving(true);
    try {
      await saveMarkdown(token, paperId, markdown);
      setLastSaved(new Date());
      if (!auto) console.log('Saved manually');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [token, paperId, markdown]);

  // Get cursor position in textarea
  const getCursorPos = (): { start: number; end: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return { start: ta.selectionStart, end: ta.selectionEnd };
  };

  // Insert text at cursor position
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = getCursorPos();
    if (!pos) return;
    const newMarkdown = markdown.substring(0, pos.start) + text + markdown.substring(pos.end);
    setMarkdown(newMarkdown);
    // Set cursor after inserted text
    setTimeout(() => {
      ta.focus();
      const newPos = pos.start + text.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Open MathLive popup
  const openMathPopup = (block: boolean = false) => {
    setIsBlockFormula(block);
    setMathFieldValue('');
    setShowMathPopup(true);
    // Focus the mathfield after it renders
    setTimeout(() => {
      const mf = document.querySelector('math-field');
      if (mf) {
        mathFieldRef.current = mf as HTMLElement;
        (mf as any).focus();
      }
    }, 100);
  };

  // Confirm math formula insertion
  const confirmMathInsert = () => {
    const latex = mathFieldValue.trim();
    if (!latex) {
      setShowMathPopup(false);
      return;
    }
    const wrapped = isBlockFormula ? `$$${latex}$$` : `$${latex}$`;
    insertAtCursor(wrapped);
    setShowMathPopup(false);
    setMathFieldValue('');
  };

  // Insert question tag at cursor
  const insertQuestionTag = () => {
    const num = tagCount + 1;
    insertAtCursor(`\n<!--Q${num}_START-->\n在此输入题目内容\n<!--Q${num}_END-->\n`);
  };

  // Insert answer marker
  const insertAnswerMarker = () => {
    insertAtCursor('\n【答案】');
  };

  // Insert analysis marker
  const insertAnalysisMarker = () => {
    insertAtCursor('\n【解析】');
  };

  // Insert image reference
  const insertImage = () => {
    const url = prompt('请输入图片URL:', '/uploads/papers/mineru-images/');
    if (url) {
      insertAtCursor(`![图片](${url})`);
    }
  };

  // Download source file
  const handleDownloadSource = () => {
    window.open(getDownloadSourceUrl(paperId), '_blank');
  };

  // Navigate to split preview
  const goSplitPreview = () => {
    handleSave(false).then(() => {
      navigate(`/papers/${paperId}/split-preview`);
    });
  };

  if (loading) {
    return <div className="paper-edit-loading">加载中...</div>;
  }

  return (
    <div className="paper-edit-container">
      {/* Header */}
      <div className="paper-edit-header">
        <div className="header-left">
          <button className="btn btn-secondary" onClick={() => navigate('/papers')}>
            ← 返回
          </button>
          <h2>{title}</h2>
          {tagCount > 0 && (
            <span className="tag-count-badge">{tagCount} 道题</span>
          )}
        </div>
        <div className="header-right">
          {saving && <span className="save-status">保存中...</span>}
          {lastSaved && !saving && (
            <span className="save-status">已保存 {lastSaved.toLocaleTimeString()}</span>
          )}
          <button className="btn btn-secondary" onClick={handleDownloadSource}>
            下载源文件
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave(false)}>
            保存草稿
          </button>
          <button className="btn btn-primary" onClick={goSplitPreview}>
            预览拆分
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="paper-edit-tips">
        <strong>编辑说明：</strong>
        点击"插入公式"使用 MathLive 可视化公式编辑器，公式以 <code>$...$</code>（行内）或 <code>$$...$$</code>（独立块）格式插入。
        点击"添加题目标签"插入题目边界标记。支持手动输入中文、英文、LaTeX 公式。
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <button className="toolbar-btn" onClick={() => openMathPopup(false)} title="插入行内公式 ($...$)">
          ∑ 行内公式
        </button>
        <button className="toolbar-btn" onClick={() => openMathPopup(true)} title="插入块级公式 ($$...$$)">
          ∫ 独立公式
        </button>
        <span className="toolbar-divider" />
        <button className="toolbar-btn btn-accent" onClick={insertQuestionTag} title="插入题目标签">
          + 题目标签
        </button>
        <button className="toolbar-btn" onClick={insertAnswerMarker} title="插入答案标记">
          【答案】
        </button>
        <button className="toolbar-btn" onClick={insertAnalysisMarker} title="插入解析标记">
          【解析】
        </button>
        <span className="toolbar-divider" />
        <button className="toolbar-btn" onClick={insertImage} title="插入图片">
          📷 图片
        </button>
      </div>

      {/* Dual-pane: editor + preview */}
      <div className="editor-dual-pane">
        {/* Left: Source editor */}
        <div className="editor-pane">
          <div className="pane-header">
            <span>📝 源码编辑</span>
          </div>
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="在此编辑试卷内容..."
            spellCheck={false}
          />
        </div>

        {/* Right: Live preview */}
        <div className="preview-pane">
          <div className="pane-header">
            <span>👁 实时预览</span>
            <span className="tag-hint">标签已隐藏，公式已渲染</span>
          </div>
          <div className="preview-content">
            <MathText text={previewContent.replace(/<!--Q\d+_(START|END)-->/g, '')} />
          </div>
        </div>
      </div>

      {/* MathLive Popup */}
      {showMathPopup && (
        <div className="math-popup-overlay" onClick={() => setShowMathPopup(false)}>
          <div className="math-popup" onClick={(e) => e.stopPropagation()}>
            <div className="math-popup-header">
              <h3>{isBlockFormula ? '插入独立公式' : '插入行内公式'}</h3>
              <button className="popup-close" onClick={() => setShowMathPopup(false)}>✕</button>
            </div>
            <div className="math-popup-body">
              <p className="math-popup-hint">
                在下方编辑器中输入公式，支持键盘输入和虚拟键盘。点击"确认插入"将公式插入到文本中。
              </p>
              {/* MathLive mathfield element — cast to any to avoid JSX type issues */}
              {(() => {
                const MathField = 'math-field' as any;
                return (
                  <MathField
                    onInput={(e: any) => {
                      const value = e.target?.value || '';
                      setMathFieldValue(value);
                    }}
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
                <strong>LaTeX 输出:</strong>
                <code>{isBlockFormula ? `$$${mathFieldValue}$$` : `$${mathFieldValue}$`}</code>
              </div>
            </div>
            <div className="math-popup-footer">
              <button className="btn btn-secondary" onClick={() => setShowMathPopup(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={confirmMathInsert}>
                确认插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
