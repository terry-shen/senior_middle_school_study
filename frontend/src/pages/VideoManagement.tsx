import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listResources, deleteResource, updateResource, importResources, createResource } from '../services/video-library-api';
import type { VideoResource } from '../services/video-library-api';
import { useSubject } from '../contexts/SubjectContext';
import './VideoManagement.css';

export default function VideoManagement() {
  const { token } = useAuth();
  const { subjects: allSubjects } = useSubject();
  const [items, setItems] = useState<VideoResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [type, setType] = useState<'all' | 'video' | 'document'>('all');
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (p = page, t = type, k = keyword) => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await listResources(token, {
        type: t === 'all' ? undefined : t,
        keyword: k || undefined,
        page: p,
        limit: 15,
      }, true);
      setItems(r.data || []);
      setTotalPages(r.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [token, page, type, keyword]);

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleActive = async (r: VideoResource) => {
    if (!token) return;
    await updateResource(token, r.id, { isActive: !r.isActive });
    load();
  };

  const handleDelete = async (r: VideoResource) => {
    if (!token || !window.confirm(`确认删除「${r.title}」？`)) return;
    await deleteResource(token, r.id);
    setMessage('已删除');
    load();
  };

  const formatSize = (s?: number | string | null) => {
    const n = typeof s === 'string' ? parseInt(s) : s;
    if (!n) return '-';
    if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + 'GB';
    if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB';
    return (n / 1024).toFixed(0) + 'KB';
  };

  return (
    <div className="video-management">
      <h1>🎛️ 资源管理</h1>
      {message && <div className="vm-message">{message}</div>}

      <div className="vm-toolbar">
        <div className="vm-type-tabs">
          {(['all', 'video', 'document'] as const).map((t) => (
            <button key={t} className={type === t ? 'active' : ''} onClick={() => { setType(t); load(1, t); }}>
              {t === 'all' ? '全部' : t === 'video' ? '🎬 视频' : '📄 教辅'}
            </button>
          ))}
        </div>
        <div className="vm-search">
          <input type="text" placeholder="搜索标题..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1, type, keyword); }} />
          <button onClick={() => load(1, type, keyword)}>搜索</button>
        </div>
        <div className="vm-actions">
          <button className="vm-btn-primary" onClick={() => setShowCreate(true)}>➕ 手动添加</button>
          <button className="vm-btn-secondary" onClick={() => setShowImport(true)}>📥 批量导入</button>
          <button className="vm-btn-secondary" onClick={() => load()}>🔄 刷新</button>
        </div>
      </div>

      {loading ? <p>加载中...</p> : (
        <table className="vm-table">
          <thead>
            <tr><th>标题</th><th>类型</th><th>学科</th><th>章节</th><th>大小</th><th>分享</th><th>本地</th><th>播放/查看</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className={r.isActive ? '' : 'vm-inactive'}>
                <td className="vm-title-cell">
                  <span className="vm-title">{r.title}</span>
                  {r.description && <span className="vm-desc">{r.description}</span>}
                </td>
                <td>{r.resourceType === 'video' ? '🎬' : '📄'}</td>
                <td>{r.subject ? `${r.subject.icon || ''}${r.subject.name}` : <span className="vm-tag-all">全科</span>}</td>
                <td>{r.chapter || '-'}</td>
                <td>{formatSize(r.fileSize)}</td>
                <td>{r.shareUrl ? <a href={r.shareUrl} target="_blank" rel="noreferrer" className="vm-link">链接</a> : '-'}</td>
                <td>{r.fileUrl ? <span className="vm-local">✓</span> : '-'}</td>
                <td className="vm-counts">{r.playCount}/{r.viewCount}</td>
                <td>
                  <span className={`vm-badge ${r.isActive ? 'vm-on' : 'vm-off'}`}>{r.isActive ? '上架' : '下架'}</span>
                </td>
                <td>
                  <div className="vm-row-actions">
                    <button onClick={() => handleToggleActive(r)} title={r.isActive ? '下架' : '上架'}>{r.isActive ? '⏸' : '▶'}</button>
                    <button onClick={() => handleDelete(r)} title="删除">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="vm-pagination">
          <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p); }}>下一页</button>
        </div>
      )}

      {showImport && (
        <ImportDialog
          token={token!}
          subjects={allSubjects}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load(); }}
        />
      )}
      {showCreate && (
        <CreateDialog
          token={token!}
          subjects={allSubjects}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function ImportDialog({ token, subjects, onClose, onDone }: {
  token: string; subjects: { id: number; name: string; icon?: string | null }[];
  onClose: () => void; onDone: () => void;
}) {
  const [dir, setDir] = useState('/apps/高中学习系统');
  const [createShare, setCreateShare] = useState(true);
  const [downloadDocuments, setDownloadDocuments] = useState(true);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [grade, setGrade] = useState('');
  const [chapter, setChapter] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleImport = async () => {
    setImporting(true);
    try {
      const r = await importResources(token, dir, { createShare, downloadDocuments });
      if (r.success) {
        setResult(`✅ 导入完成：新增 ${r.created}，跳过 ${r.skipped}，分享 ${r.shared}，下载 ${r.downloaded}${r.errors.length > 0 ? `，失败 ${r.errors.length}` : ''}`);
      } else {
        setResult(`❌ 导入失败`);
      }
    } catch (e: any) {
      setResult(`❌ ${e.message || e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="vm-dialog-overlay">
      <div className="vm-dialog">
        <h2>📥 从网盘批量导入</h2>
        <div className="vm-form-row"><label>目录路径</label><input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="/apps/高中学习系统" /></div>
        <div className="vm-form-row"><label>归属学科</label>
          <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
            <option value={0}>全科可见</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon || ''}{s.name}</option>)}
          </select>
        </div>
        <div className="vm-form-row"><label>年级</label><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="如：高一" /></div>
        <div className="vm-form-row"><label>章节</label><input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="如：函数" /></div>
        <div className="vm-form-row">
          <label><input type="checkbox" checked={createShare} onChange={(e) => setCreateShare(e.target.checked)} /> 视频自动生成分享链接</label>
        </div>
        <div className="vm-form-row">
          <label><input type="checkbox" checked={downloadDocuments} onChange={(e) => setDownloadDocuments(e.target.checked)} /> 教辅自动下载到本地</label>
        </div>
        {result && <div className="vm-result">{result}</div>}
        <div className="vm-dialog-actions">
          <button className="vm-btn-primary" onClick={handleImport} disabled={importing}>{importing ? '导入中...' : '开始导入'}</button>
          <button onClick={onDone}>完成</button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function CreateDialog({ token, subjects, onClose, onDone }: {
  token: string; subjects: { id: number; name: string; icon?: string | null }[];
  onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: '', subjectId: 0, grade: '', chapter: '', resourceType: 'video' as 'video' | 'document',
    netdiskPath: '', description: '', sort: 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title || !form.netdiskPath) { alert('请填写标题与网盘路径'); return; }
    setSaving(true);
    try {
      const r = await createResource(token, {
        title: form.title,
        subjectId: form.subjectId || null,
        grade: form.grade || null,
        chapter: form.chapter || null,
        resourceType: form.resourceType,
        netdiskPath: form.netdiskPath,
        description: form.description || null,
        sort: form.sort,
      });
      if (r.success) { onDone(); } else { alert(r.error || '创建失败'); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vm-dialog-overlay">
      <div className="vm-dialog">
        <h2>➕ 手动添加资源</h2>
        <div className="vm-form-row"><label>标题 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="vm-form-row"><label>类型</label>
          <select value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value as 'video' | 'document' })}>
            <option value="video">🎬 视频</option><option value="document">📄 教辅</option>
          </select>
        </div>
        <div className="vm-form-row"><label>学科</label>
          <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: Number(e.target.value) })}>
            <option value={0}>全科可见</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon || ''}{s.name}</option>)}
          </select>
        </div>
        <div className="vm-form-row"><label>年级</label><input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
        <div className="vm-form-row"><label>章节</label><input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></div>
        <div className="vm-form-row"><label>网盘路径 *</label><input value={form.netdiskPath} onChange={(e) => setForm({ ...form, netdiskPath: e.target.value })} placeholder="/apps/高中学习系统/xxx.mp4" /></div>
        <div className="vm-form-row"><label>描述</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="vm-form-row"><label>排序</label><input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} /></div>
        <div className="vm-dialog-actions">
          <button className="vm-btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
