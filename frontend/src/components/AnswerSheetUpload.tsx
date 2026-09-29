import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  uploadAnswerSheet,
  getMyAnswerSheets,
  normalizeSheetUrl,
  type AnswerSheet,
} from '../services/answer-sheets-api';

interface Props {
  token: string;
  scene: { examId?: number; mockExamId?: number; wholePaperId?: number };
  /** 当场景是整卷测验时需要显示的场景标题（可选） */
  sceneLabel?: string;
}

/**
 * 学生答题纸上传区。
 * 进入时先查自己该场景的答题纸（可能已上传/已批改），再提供上传/替换/查看入口。
 */
export default function AnswerSheetUpload({ token, scene, sceneLabel }: Props) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<AnswerSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { answerSheets } = await getMyAnswerSheets(token);
      const matched = answerSheets.find(
        (s) =>
          (scene.examId && s.examId === scene.examId) ||
          (scene.mockExamId && s.mockExamId === scene.mockExamId) ||
          (scene.wholePaperId && s.wholePaperId === scene.wholePaperId)
      );
      setSheet(matched || null);
    } catch (e: any) {
      setError(e.message || '加载答题纸失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, scene.examId, scene.mockExamId, scene.wholePaperId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadAnswerSheet(token, file, scene);
      setSheet(result.answerSheet || null);
    } catch (err: any) {
      setError(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="answer-sheet-upload">加载答题纸状态...</div>;

  return (
    <div className="answer-sheet-upload">
      <h4>📝 答题纸提交{sceneLabel ? `（${sceneLabel}）` : ''}</h4>
      <p className="hint">考试结束后，请将答题纸拍照或导出 Word 后上传。老师将离线阅卷并在答题纸上做批注。</p>

      {sheet ? (
        <div className="sheet-card">
          <div className="sheet-status">
            状态：
            <span className={`badge badge-${sheet.status}`}>
              {sheet.status === 'submitted' ? '已提交（待批改）' : '已批改'}
            </span>
            {sheet.fileType === 'image' && sheet.fileUrl && (
              <a href={normalizeSheetUrl(sheet.fileUrl)} target="_blank" rel="noreferrer" className="link-view">
                查看答题纸
              </a>
            )}
            {sheet.fileType === 'word' && sheet.fileUrl && (
              <a href={normalizeSheetUrl(sheet.fileUrl)} target="_blank" rel="noreferrer" className="link-view">
                下载答题纸
              </a>
            )}
          </div>
          {sheet.status === 'graded' && (
            <div className="grading-result">
              <p><strong>得分：</strong>{sheet.totalScore ?? '-'}</p>
              {sheet.teacherComment && (
                <p><strong>老师评语：</strong>{sheet.teacherComment}</p>
              )}
              <button className="btn-view-grading" onClick={() => navigate(`/answer-sheets/${sheet.id}`)}>
                查看批改详情（含批注）
              </button>
            </div>
          )}
          <label className="btn-replace">
            重新上传
            <input type="file" accept="image/*,.doc,.docx" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <label className="btn-upload-sheet">
          {uploading ? '上传中...' : '📤 上传答题纸（图片或 Word）'}
          <input type="file" accept="image/*,.doc,.docx" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}