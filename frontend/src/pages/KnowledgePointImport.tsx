import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { uploadWordDocument } from '../services/knowledge-point-import-api';
import './KnowledgePointImport.css';

export default function KnowledgePointImport() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const lower = f.name.toLowerCase();
      if (!lower.endsWith('.docx') && !lower.endsWith('.doc')) {
        setError('仅支持 .docx 或 .doc 格式的 Word 文档');
        setFile(null);
        return;
      }
      setError('');
      setFile(f);
    }
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await uploadWordDocument(token, file);
      setSuccessMsg(`文档 "${result.doc.name}" 已成功导入，即将跳转到编辑器`);
      setTimeout(() => {
        navigate(`/knowledge-points/${result.doc.id}/edit`);
      }, 1500);
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="kp-import">
      <div className="kp-import-header">
        <h2>知识点文档导入</h2>
        <button onClick={() => navigate('/knowledge-points')} className="btn btn-secondary">
          返回列表
        </button>
      </div>

      <div className="upload-zone">
        <p className="upload-tip">
          支持 .docx / .doc 格式的 Word 文档，上传后将自动转换为 Markdown 并跳转到编辑器进行校准。
        </p>
        <input
          type="file"
          accept=".docx,.doc"
          onChange={handleFileChange}
          className="file-input"
        />
        {file && (
          <div className="file-info">
            <span>已选择: {file.name}</span>
            <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="btn btn-primary"
        >
          {uploading ? '上传中...' : '上传并导入'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}
    </div>
  );
}
