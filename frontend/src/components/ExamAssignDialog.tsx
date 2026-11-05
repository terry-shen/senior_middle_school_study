import { useEffect, useState } from 'react';
import './ExamAssignDialog.css';

const API_BASE = 'http://localhost:3000/api';

export interface ClassItem {
  id: number;
  name: string;
  grade: string;
}

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (payload: { classIds: number[]; studentIds: number[]; startTime?: string; endTime?: string }) => Promise<void>;
  confirmLabel?: string;
}

export default function ExamAssignDialog({ visible, title, onClose, onConfirm, confirmLabel = '发布' }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSelectedClassIds([]);
    setStartTime('');
    setEndTime('');
    fetch(`${API_BASE}/classes/list`)
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d?.classes) ? d.classes : []))
      .catch(() => setClasses([]));
  }, [visible]);

  if (!visible) return null;

  const toggleClass = (id: number) => {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleConfirm = async () => {
    if (selectedClassIds.length === 0) {
      setError('请至少选择一个参考班级');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        classIds: selectedClassIds,
        studentIds: [],
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="exam-assign-overlay" onClick={onClose}>
      <div className="exam-assign-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="exam-assign-header">
          <h3>{title}</h3>
          <button className="exam-assign-close" onClick={onClose}>✕</button>
        </div>

        <div className="exam-assign-body">
          <div className="exam-assign-section">
            <div className="exam-assign-label">参考班级 <span className="assign-count">已选 {selectedClassIds.length} 个班级</span></div>
            {classes.length === 0 ? (
              <p className="assign-empty">暂无班级</p>
            ) : (
              <div className="class-checkbox-list">
                {classes.map((c) => (
                  <label key={c.id} className={`class-checkbox ${selectedClassIds.includes(c.id) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                    />
                    <span>{c.grade} {c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="exam-assign-row">
            <div className="exam-assign-field">
              <label>开始时间（可选）</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="exam-assign-field">
              <label>结束时间（可选）</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {error && <div className="exam-assign-error">{error}</div>}
        </div>

        <div className="exam-assign-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? '提交中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
