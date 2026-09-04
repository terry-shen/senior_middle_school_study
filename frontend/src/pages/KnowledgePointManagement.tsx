import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getKpDocuments,
  deleteKpDocument,
  createKpDocument,
  type KPDocument,
} from '../services/knowledge-point-import-api';
import './KnowledgePointManagement.css';

export default function KnowledgePointManagement() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [docs, setDocs] = useState<KPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!token) return;
    loadDocs();
  }, [token]);

  const loadDocs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await getKpDocuments(token);
      setDocs(list);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm('确认删除此知识点文档？')) return;
    try {
      await deleteKpDocument(token, id);
      await loadDocs();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreate = async () => {
    if (!token || !newName.trim()) return;
    try {
      const doc = await createKpDocument(token, newName.trim());
      setNewName('');
      setShowCreate(false);
      navigate(`/knowledge-points/${doc.id}/edit`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="kp-management">
      <div className="kp-header">
        <h2>知识点文档</h2>
        {isAdmin && (
          <div className="header-actions">
            <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
              新建文档
            </button>
            <button onClick={() => navigate('/knowledge-points/import')} className="btn btn-secondary">
              导入 Word
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreate && (
        <div className="create-form">
          <input
            type="text"
            placeholder="文档名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button onClick={handleCreate} className="btn btn-primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn btn-secondary">取消</button>
        </div>
      )}

      {loading ? (
        <p>加载中...</p>
      ) : docs.length === 0 ? (
        <p className="empty-state">暂无知识点文档</p>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.name}</td>
                <td>{new Date(doc.updatedAt).toLocaleString()}</td>
                <td>
                  <button
                    onClick={() => navigate(`/knowledge-points/${doc.id}/edit`)}
                    className="btn btn-secondary btn-sm"
                  >
                    {isAdmin ? '编辑' : '查看'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="btn btn-danger btn-sm"
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
