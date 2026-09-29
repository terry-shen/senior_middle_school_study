import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAnswerSheet,
  gradeAnswerSheet,
  uploadGradedSheet,
  normalizeSheetUrl,
  parseAnnotations,
  type AnswerSheet,
} from '../services/answer-sheets-api';
import './AnswerSheets.css';

type Tool = 'rect' | 'text' | 'pen';
interface Annotation {
  type: Tool;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color: string;
  size?: number;
  points?: { x: number; y: number }[];
}

const COLORS = ['#e53935', '#1e88e5', '#000000', '#fbc02d'];

export default function AnswerSheetDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [sheet, setSheet] = useState<AnswerSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Canvas annotation state
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([]);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  // Grading form
  const [totalScore, setTotalScore] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [gradedFile, setGradedFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!id || !token) return;
    setLoading(true);
    try {
      const r = await getAnswerSheet(token, parseInt(id));
      setSheet(r.answerSheet || null);
      const anns = parseAnnotations(r.answerSheet?.annotations).map((a: any) => ({ ...a, color: a.color || COLORS[0] }));
      setAnnotations(anns as Annotation[]);
      setTotalScore(r.answerSheet?.totalScore?.toString() || '');
      setTeacherComment(r.answerSheet?.teacherComment || '');
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Redraw annotations on canvas whenever they change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    annotations.forEach((a) => {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = 2;
      if (a.type === 'rect' && a.w !== undefined && a.h !== undefined) {
        ctx.strokeRect(a.x ?? 0, a.y ?? 0, a.w, a.h);
      } else if (a.type === 'text' && a.text) {
        ctx.font = '16px sans-serif';
        ctx.fillText(a.text, a.x ?? 0, a.y ?? 0);
      } else if (a.type === 'pen' && a.points && a.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(a.points[0].x, a.points[0].y);
        for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
        ctx.stroke();
      }
    });
  }, [annotations]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!isAdmin || sheet?.fileType !== 'image') return;
    const p = getCanvasPos(e);
    if (tool === 'text') {
      setTextPrompt(p);
      setTextValue('');
      return;
    }
    setDrawing(true);
    setStartPos(p);
    if (tool === 'pen') setPenPoints([p]);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !startPos) return;
    const p = getCanvasPos(e);
    if (tool === 'pen') {
      setPenPoints((prev) => [...prev, p]);
    } else if (tool === 'rect') {
      // Live preview by temporary annotation
      const temp: Annotation = { type: 'rect', x: startPos.x, y: startPos.y, w: p.x - startPos.x, h: p.y - startPos.y, color };
      const others = annotations.slice(0, -1);
      setAnnotations([...others, temp]);
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!drawing || !startPos) return;
    const p = getCanvasPos(e);
    if (tool === 'rect') {
      const w = p.x - startPos.x;
      const h = p.y - startPos.y;
      if (Math.abs(w) > 5 && Math.abs(h) > 5) {
        setAnnotations((prev) => {
          const withoutTemp = prev.slice(0, -1);
          return [...withoutTemp, { type: 'rect', x: startPos.x, y: startPos.y, w, h, color }];
        });
      } else {
        setAnnotations((prev) => prev.slice(0, -1));
      }
    } else if (tool === 'pen' && penPoints.length > 1) {
      setAnnotations((prev) => [...prev, { type: 'pen', points: penPoints, color }]);
    }
    setDrawing(false);
    setStartPos(null);
    setPenPoints([]);
  };

  const commitText = () => {
    if (!textPrompt || !textValue.trim()) {
      setTextPrompt(null);
      return;
    }
    setAnnotations((prev) => [...prev, { type: 'text', x: textPrompt.x, y: textPrompt.y, text: textValue, color }]);
    setTextPrompt(null);
    setTextValue('');
  };

  const undo = () => setAnnotations((prev) => prev.slice(0, -1));
  const clearAll = () => setAnnotations([]);

  const handleSave = async () => {
    if (!token || !sheet) return;
    setSaving(true);
    setError('');
    try {
      await gradeAnswerSheet(token, sheet.id, {
        annotations,
        totalScore: totalScore ? parseInt(totalScore) : undefined,
        teacherComment,
      });
      alert('批改已保存');
      await load();
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadGraded = async () => {
    if (!token || !sheet || !gradedFile) return;
    setSaving(true);
    try {
      await uploadGradedSheet(token, sheet.id, gradedFile);
      alert('批改版已上传');
      setGradedFile(null);
      await load();
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="answer-sheet-detail">加载中...</div>;
  if (error && !sheet) return <div className="answer-sheet-detail error-msg">{error}</div>;
  if (!sheet) return <div className="answer-sheet-detail">答题纸不存在</div>;

  const isImage = sheet.fileType === 'image';

  return (
    <div className="answer-sheet-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/answer-sheets')}>← 返回列表</button>
        <h1>答题纸 #{sheet.id}</h1>
        <span className={`badge badge-${sheet.status}`}>
          {sheet.status === 'submitted' ? '待批改' : '已批改'}
        </span>
      </div>

      <div className="detail-meta">
        <p><strong>场景：</strong>{sheet.sceneTitle} ({sheet.sceneType})</p>
        <p><strong>学生：</strong>{sheet.student?.name} ({sheet.student?.studentId})</p>
        <p><strong>文件：</strong>{sheet.fileName || '-'}</p>
        <p><strong>提交时间：</strong>{new Date(sheet.createdAt).toLocaleString('zh-CN')}</p>
      </div>

      <div className="detail-body">
        <div className="sheet-viewer">
          {isImage ? (
            <div className="image-canvas-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={normalizeSheetUrl(sheet.fileUrl)}
                alt="答题纸"
                onLoad={redraw}
                style={{ maxWidth: '100%', display: 'block' }}
              />
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{ position: 'absolute', top: 0, left: 0, cursor: isAdmin ? 'crosshair' : 'default' }}
              />
              {textPrompt && (
                <div className="text-input-popup" style={{ position: 'absolute', left: textPrompt.x, top: textPrompt.y }}>
                  <input
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitText();
                      if (e.key === 'Escape') setTextPrompt(null);
                    }}
                    placeholder="批注文字..."
                  />
                  <button onClick={commitText}>确定</button>
                </div>
              )}
            </div>
          ) : (
            <div className="word-sheet">
              <p>Word 文档答题纸：</p>
              <a href={normalizeSheetUrl(sheet.fileUrl)} target="_blank" rel="noreferrer" className="btn-download">
                下载原始答题纸
              </a>
              {sheet.gradedFileUrl && (
                <a href={normalizeSheetUrl(sheet.gradedFileUrl)} target="_blank" rel="noreferrer" className="btn-download">
                  下载批改版
                </a>
              )}
              {isAdmin && (
                <div className="upload-graded">
                  <label className="btn-upload-graded">
                    {gradedFile ? gradedFile.name : '上传批改版 Word'}
                    <input
                      type="file"
                      accept=".doc,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => setGradedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {gradedFile && (
                    <button className="btn-save" onClick={handleUploadGraded} disabled={saving}>
                      保存批改版
                    </button>
                  )}
                </div>
              )}
              <p className="hint">老师下载原 doc，本地 Word 批注后回传批改版。</p>
            </div>
          )}
        </div>

        <div className="grading-panel">
          {isAdmin && isImage && (
            <div className="annotation-tools">
              <h3>批注工具</h3>
              <div className="tool-row">
                <button className={tool === 'rect' ? 'active' : ''} onClick={() => setTool('rect')}>矩形</button>
                <button className={tool === 'text' ? 'active' : ''} onClick={() => setTool('text')}>文字</button>
                <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>画笔</button>
              </div>
              <div className="color-row">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <div className="action-row">
                <button onClick={undo}>撤销</button>
                <button onClick={clearAll}>清空</button>
              </div>
            </div>
          )}

          <div className="grading-form">
            <h3>评分</h3>
            {isAdmin ? (
              <>
                <label>总分</label>
                <input
                  type="number"
                  value={totalScore}
                  onChange={(e) => setTotalScore(e.target.value)}
                  placeholder="如 85"
                />
                <label>老师评语</label>
                <textarea
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  placeholder="对学生答卷的评语、扣分点说明等"
                  rows={4}
                />
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存批改'}
                </button>
              </>
            ) : (
              <>
                <p><strong>得分：</strong>{sheet.totalScore ?? '尚未评分'}</p>
                <p><strong>评语：</strong>{sheet.teacherComment || '（无）'}</p>
              </>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}
        </div>
      </div>
    </div>
  );
}