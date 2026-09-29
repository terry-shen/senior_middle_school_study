import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getPaperLibrary,
  getPaperLibraryFilters,
  updatePaperLibraryPaper,
  publishPaperAsMockExam,
  unpublishMockExam,
  getRecoveryList,
  importWholePapers,
  importWholePaper,
  downloadWholePaperFile,
  triggerBlobDownload,
  deletePaper,
  type ExamPaper,
  type PaperLibraryFilterOptions,
  type RecoveryGroup,
  type MultiImportResult,
} from '../services/papers-api';
import './PaperLibrary.css';

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '理综', '文综', '其他'];

const getStatusText = (status?: string) => {
  const map: Record<string, string> = {
    draft: '草稿', published: '已发布', in_progress: '进行中', completed: '已结束',
    uploaded: '待编辑', editing: '编辑中', split_preview: '待确认', pending: '待处理',
  };
  return map[status || ''] || status || '-';
};

export default function PaperLibrary() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'library' | 'recovery'>('library');
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<PaperLibraryFilterOptions>({ subjects: [], years: [], regions: [], examTypes: [], schools: [] });
  const [recoveryGroups, setRecoveryGroups] = useState<RecoveryGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [multiResults, setMultiResults] = useState<MultiImportResult[]>([]);
  const [editPaper, setEditPaper] = useState<ExamPaper | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [publishPaper, setPublishPaper] = useState<ExamPaper | null>(null);
  const [publishForm, setPublishForm] = useState<{ totalScore: string; duration: string; startTime: string; endTime: string }>({ totalScore: '', duration: '', startTime: '', endTime: '' });
  // paperId -> published mockExamId
  const [publishedMap, setPublishedMap] = useState<Record<number, number>>({});

  const loadPapers = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getPaperLibrary(token, {
        purpose: 'whole_paper',
        page: targetPage,
        limit: 20,
        ...(filters as any),
      });
      setPapers(res.data || []);
      setTotal(res.pagination?.total || 0);
      setPage(res.pagination?.page || 1);
    } catch (e: any) {
      setError(e.message || '试卷库加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    if (!token) return;
    try {
      setOptions(await getPaperLibraryFilters(token));
    } catch (e) {
      console.error('filters', e);
    }
  };

  const loadRecovery = async () => {
    if (!token) return;
    try {
      const res = await getRecoveryList(token);
      setRecoveryGroups(res.groups || []);
    } catch (e: any) {
      setError(e.message || '回收批改加载失败');
    }
  };

  useEffect(() => {
    if (!token) return;
    loadPapers(1);
    loadFilters();
    loadPublishedMap();
  }, [token]);

  useEffect(() => {
    if (tab === 'recovery') loadRecovery();
  }, [tab, token]);

  // 已发布试卷 → mockExamId 映射（用于显示"取消发布"）
  const loadPublishedMap = async () => {
    if (!token) return;
    try {
      const groups = (await getRecoveryList(token)).groups || [];
      const map: Record<number, number> = {};
      groups.forEach((g) => {
        if (g.paper) map[g.paper.id] = g.mockExamId;
      });
      setPublishedMap(map);
    } catch { /* silent */ }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => loadPapers(1), 0);
  };

  // ===== 导入 =====
  const handleSingleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    setImporting(true); setError(''); setMessage('');
    try {
      const res = await importWholePaper(token, file, { title: '' });
      if (res.success && res.paper) {
        setMessage(`导入成功: ${res.paper.title}`);
        await loadPapers(1);
        await loadFilters();
      } else {
        setError(res.error || '导入失败');
      }
    } catch (e: any) {
      setError(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDirChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (picked.length === 0 || !token) return;
    const supported = picked.filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith('.pdf') || n.endsWith('.docx') || n.endsWith('.doc') || n.endsWith('.txt') || f.type.startsWith('image/');
    });
    const skipped = picked.length - supported.length;
    if (supported.length === 0) {
      setError('目录中没有可导入的试卷文件（支持 PDF/Word/TXT/图片）');
      return;
    }
    setImporting(true); setError(''); setMessage(''); setMultiResults([]);
    if (skipped > 0) setError(`已跳过 ${skipped} 个不支持的杂项文件`);
    try {
      const CHUNK = 20;
      const all: MultiImportResult[] = [];
      for (let i = 0; i < supported.length; i += CHUNK) {
        const batch = supported.slice(i, i + CHUNK);
        const res = await importWholePapers(token, batch);
        if (res.success && res.results) all.push(...res.results);
        else batch.forEach((f) => all.push({ success: false, fileName: f.name, error: '批次上传失败' }));
      }
      setMultiResults(all);
      setMessage(`文件夹整卷导入完成: ${all.filter((r) => r.success).length}/${supported.length} 成功`);
      await loadPapers(1);
      await loadFilters();
    } catch (e: any) {
      setError(e.message || '文件夹导入失败');
    } finally {
      setImporting(false);
    }
  };

  // ===== 元数据编辑 =====
  const openEdit = (p: ExamPaper) => {
    setEditPaper(p);
    setEditForm({
      title: p.title || '',
      subject: p.subject || '',
      school: p.school || '',
      year: p.year ? String(p.year) : '',
      region: p.region || '',
      examType: p.examType || '',
      totalScore: p.totalScore ? String(p.totalScore) : '',
      duration: p.duration ? String(p.duration) : '',
    });
  };

  const saveMeta = async () => {
    if (!token || !editPaper) return;
    try {
      await updatePaperLibraryPaper(token, editPaper.id, {
        title: editForm.title,
        subject: editForm.subject,
        school: editForm.school,
        year: editForm.year,
        region: editForm.region,
        examType: editForm.examType,
        totalScore: editForm.totalScore,
        duration: editForm.duration,
      } as any);
      setMessage('元数据已更新');
      setEditPaper(null);
      await loadPapers();
      await loadFilters();
    } catch (e: any) {
      setError(e.message || '保存失败');
    }
  };

  // ===== 发布 / 取消发布 =====
  const openPublish = (p: ExamPaper) => {
    setPublishPaper(p);
    setPublishForm({
      totalScore: p.totalScore ? String(p.totalScore) : '100',
      duration: p.duration ? String(p.duration) : '120',
      startTime: '', endTime: '',
    });
  };

  const doPublish = async () => {
    if (!token || !publishPaper) return;
    try {
      const res = await publishPaperAsMockExam(token, publishPaper.id, {
        startTime: publishForm.startTime || undefined,
        endTime: publishForm.endTime || undefined,
      });
      setMessage(`已发布为模拟考试（ID: ${res.mockExamId}），学生可在"模拟考试"中下载作答`);
      setPublishPaper(null);
      await loadPublishedMap();
    } catch (e: any) {
      setError(e.message || '发布失败');
    }
  };

  const doUnpublish = async (p: ExamPaper) => {
    if (!token) return;
    if (!confirm(`确定取消发布「${p.title}」吗？相关答题纸记录将一并删除。`)) return;
    try {
      await unpublishMockExam(token, p.id);
      setMessage('已取消发布');
      await loadPapers();
      await loadPublishedMap();
      if (tab === 'recovery') loadRecovery();
    } catch (e: any) {
      setError(e.message || '取消发布失败');
    }
  };

  const handleDownload = async (p: ExamPaper) => {
    if (!token) return;
    try {
      const ext = (p.pdfUrl?.split('.').pop() || 'doc').toLowerCase();
      const { blob, filename } = await downloadWholePaperFile(token, p.id, `${p.title}.${ext}`);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      setError(e.message || '下载失败');
    }
  };

  const handleDelete = async (p: ExamPaper) => {
    if (!token) return;
    if (!confirm(`确定删除试卷「${p.title}」吗？`)) return;
    try {
      await deletePaper(token, p.id);
      setMessage('已删除');
      await loadPapers();
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  };

  // ===== 学科统计 =====
  const subjectStats = () => {
    const map: Record<string, number> = {};
    papers.forEach((p) => {
      const s = p.subject || '未分类';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const totalPages = Math.ceil(total / 20);

  if (!token) return <div className="paper-library">请先登录</div>;

  return (
    <div className="paper-library">
      <h1>试卷库</h1>
      <p className="lib-hint">整卷试卷全生命周期：导入 → 分类管理 → 发布考试 → 回收批改。拆分导入请前往「题库管理」。</p>

      <div className="lib-tabs">
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>试卷管理</button>
        <button className={tab === 'recovery' ? 'active' : ''} onClick={() => setTab('recovery')}>回收批改</button>
      </div>

      {tab === 'library' && (
        <>
          {isAdmin && (
            <div className="lib-import">
              <div className="import-row">
                <label className="btn-import">
                  单文件整卷导入
                  <input type="file" accept=".pdf,.docx,.doc,.txt,image/*" style={{ display: 'none' }} onChange={handleSingleImport} />
                </label>
                <button className="btn-import" onClick={() => dirInputRef.current?.click()} disabled={importing}>
                  文件夹导入（递归全部子目录）
                </button>
                <input
                  type="file" multiple ref={dirInputRef} style={{ display: 'none' }}
                  onChange={handleDirChange} {...({ webkitdirectory: '' } as any)}
                />
                {importing && <span className="importing-hint">导入中（单文件约 2 分钟）...</span>}
              </div>
              {message && <div className="message success">{message}</div>}
              {error && <div className="message error">{error}</div>}
              {multiResults.length > 0 && (
                <details className="multi-results">
                  <summary>导入结果（{multiResults.filter((r) => r.success).length}/{multiResults.length} 成功）</summary>
                  <table>
                    <thead><tr><th>文件名</th><th>状态</th><th>试卷ID</th></tr></thead>
                    <tbody>
                      {multiResults.map((r, i) => (
                        <tr key={i}>
                          <td>{r.fileName}</td>
                          <td>{r.success ? '✅ 成功' : `❌ ${r.error || '失败'}`}</td>
                          <td>{r.paperId ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}

          <div className="lib-filters">
            <select value={filters.subject || ''} onChange={(e) => handleFilterChange('subject', e.target.value)}>
              <option value="">全部学科</option>
              {(options.subjects.length ? options.subjects : SUBJECTS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.year || ''} onChange={(e) => handleFilterChange('year', e.target.value)}>
              <option value="">全部年份</option>
              {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filters.region || ''} onChange={(e) => handleFilterChange('region', e.target.value)}>
              <option value="">全部省份</option>
              {options.regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filters.examType || ''} onChange={(e) => handleFilterChange('examType', e.target.value)}>
              <option value="">全部考试类型</option>
              {options.examTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.school || ''} onChange={(e) => handleFilterChange('school', e.target.value)}>
              <option value="">全部学校</option>
              {options.schools.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="text" placeholder="搜索标题..." value={filters.keyword || ''}
              onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') loadPapers(1); }}
            />
            <button className="btn-search" onClick={() => loadPapers(1)}>搜索</button>
            {subjectStats().length > 0 && (
              <div className="subject-stats">
                {subjectStats().slice(0, 6).map(([s, c]) => (
                  <span key={s} className="stat-chip" onClick={() => handleFilterChange('subject', s === '未分类' ? '' : s)}>
                    {s} {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="lib-table-wrap">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>标题</th><th>学科</th><th>年份</th><th>省份</th><th>学校</th>
                  <th>总分/时长</th><th>格式</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}>加载中...</td></tr>
                ) : papers.length === 0 ? (
                  <tr><td colSpan={9} className="empty">暂无整卷试卷{isAdmin ? '，请先导入' : ''}</td></tr>
                ) : (
                  papers.map((p) => {
                    const isPublished = !!publishedMap[p.id];
                    return (
                      <tr key={p.id}>
                        <td className="title-cell" title={p.title}>{p.title}</td>
                        <td>{p.subject || '—'}</td>
                        <td>{p.year || '—'}</td>
                        <td>{p.region || '—'}</td>
                        <td>{p.school || '—'}</td>
                        <td>{p.totalScore ?? '—'}分 / {p.duration ?? '—'}分</td>
                        <td>{(p.sourceFormat || '-').toUpperCase()}</td>
                        <td><span className={`badge ${isPublished ? 'badge-published' : ''}`}>{isPublished ? '已发布' : getStatusText(p.status)}</span></td>
                        <td className="actions-cell">
                          {isAdmin ? (
                            <>
                              <button className="btn-sm" onClick={() => openEdit(p)}>元数据</button>
                              {isPublished ? (
                                <button className="btn-sm btn-warn" onClick={() => doUnpublish(p)}>取消发布</button>
                              ) : (
                                <button className="btn-sm btn-primary" onClick={() => openPublish(p)}>发布考试</button>
                              )}
                              <button className="btn-sm" onClick={() => handleDownload(p)}>下载</button>
                              <button className="btn-sm btn-danger" onClick={() => handleDelete(p)}>删除</button>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => loadPapers(page - 1)}>上一页</button>
                <span>{page} / {totalPages}（共 {total} 份）</span>
                <button disabled={page >= totalPages} onClick={() => loadPapers(page + 1)}>下一页</button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'recovery' && (
        <div className="recovery-view">
          {recoveryGroups.length === 0 ? (
            <p className="empty">暂无已发布的整卷考试。请在「试卷管理」中点击「发布考试」。</p>
          ) : (
            recoveryGroups.map((g) => (
              <div key={g.mockExamId} className="recovery-card">
                <div className="recovery-head">
                  <span className="recovery-title">{g.paper?.title || `模拟考试 #${g.mockExamId}`}</span>
                  <span className={`badge ${g.status === 'published' ? 'badge-published' : ''}`}>{getStatusText(g.status)}</span>
                </div>
                <div className="recovery-stats">
                  <span>已上传 <b>{g.uploaded}</b></span>
                  <span>待批改 <b>{g.pending}</b></span>
                  <span>已批改 <b>{g.graded}</b></span>
                </div>
                {g.sheetsByStudent.length > 0 && (
                  <table className="recovery-table">
                    <thead><tr><th>学生ID</th><th>状态</th><th>得分</th><th>提交时间</th><th>操作</th></tr></thead>
                    <tbody>
                      {g.sheetsByStudent.map((s) => (
                        <tr key={s.id}>
                          <td>{s.studentId}</td>
                          <td>{s.status === 'graded' ? '已批改' : '待批改'}</td>
                          <td>{s.totalScore ?? '-'}</td>
                          <td>{new Date(s.createdAt).toLocaleString('zh-CN')}</td>
                          <td><a className="btn-sm btn-primary" href={`/answer-sheets/${s.id}`}>批注阅卷</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 元数据编辑模态框 */}
      {editPaper && (
        <div className="modal-overlay" onClick={() => setEditPaper(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑元数据</h3>
            <div className="form-row"><label>标题</label><input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
            <div className="form-row">
              <label>学科</label>
              <select value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}>
                <option value="">未设置</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row"><label>学校</label><input value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value })} placeholder="选填" /></div>
            <div className="form-row"><label>年份</label><input value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} placeholder="如 2026" /></div>
            <div className="form-row"><label>省份/地区</label><input value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} placeholder="如 全国" /></div>
            <div className="form-row"><label>考试类型</label><input value={editForm.examType} onChange={(e) => setEditForm({ ...editForm, examType: e.target.value })} placeholder="如 高考" /></div>
            <div className="form-row"><label>总分</label><input value={editForm.totalScore} onChange={(e) => setEditForm({ ...editForm, totalScore: e.target.value })} /></div>
            <div className="form-row"><label>时长(分钟)</label><input value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} /></div>
            <div className="modal-actions">
              <button onClick={() => setEditPaper(null)}>取消</button>
              <button className="btn-primary" onClick={saveMeta}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 发布模态框 */}
      {publishPaper && (
        <div className="modal-overlay" onClick={() => setPublishPaper(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>发布为模拟考试</h3>
            <p className="modal-hint">「{publishPaper.title}」将以整卷形式发布：学生下载试卷线下作答，之后上传答题纸由老师批改。</p>
            <div className="form-row"><label>总分</label><input value={publishForm.totalScore} onChange={(e) => setPublishForm({ ...publishForm, totalScore: e.target.value })} /></div>
            <div className="form-row"><label>时长(分钟)</label><input value={publishForm.duration} onChange={(e) => setPublishForm({ ...publishForm, duration: e.target.value })} /></div>
            <div className="form-row"><label>开始时间</label><input type="datetime-local" value={publishForm.startTime} onChange={(e) => setPublishForm({ ...publishForm, startTime: e.target.value })} /></div>
            <div className="form-row"><label>截止时间</label><input type="datetime-local" value={publishForm.endTime} onChange={(e) => setPublishForm({ ...publishForm, endTime: e.target.value })} /></div>
            <div className="modal-actions">
              <button onClick={() => setPublishPaper(null)}>取消</button>
              <button className="btn-primary" onClick={doPublish}>发布</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}