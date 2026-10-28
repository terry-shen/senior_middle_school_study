import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { importFromImage, importFromPDF, getPapers, deletePaper, importMultipleFiles, updatePaper } from '../services/papers-api';
import { getSelectedSubjectId } from '../services/subjects-api';
import SubjectSelect from '../components/SubjectSelect';
import type { ExamPaper, MultiImportResult } from '../services/papers-api';
import './QuestionBank.css';

type Paper = ExamPaper;

export default function QuestionBank() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [multiResults, setMultiResults] = useState<MultiImportResult[]>([]);
  const [importSubjectId, setImportSubjectId] = useState<number | null>(getSelectedSubjectId());

  // Metadata editing modal state
  const [editMetaPaper, setEditMetaPaper] = useState<Paper | null>(null);
  const [metaForm, setMetaForm] = useState({
    title: '',
    source: '',
    year: '' as string,
    region: '',
    examType: '',
    totalScore: '' as string,
    duration: '' as string,
  });
  const [savingMeta, setSavingMeta] = useState(false);

  const handleEditMeta = (paper: Paper) => {
    setMetaForm({
      title: paper.title || '',
      source: paper.source || '',
      year: paper.year ? String(paper.year) : '',
      region: paper.region || '',
      examType: paper.examType || '',
      totalScore: paper.totalScore ? String(paper.totalScore) : '',
      duration: paper.duration ? String(paper.duration) : '',
    });
    setEditMetaPaper(paper);
  };

  const handleSaveMeta = async () => {
    if (!token || !editMetaPaper) return;
    setSavingMeta(true);
    try {
      const data: any = {
        title: metaForm.title,
        source: metaForm.source,
      };
      if (metaForm.year) data.year = parseInt(metaForm.year);
      if (metaForm.region) data.region = metaForm.region;
      if (metaForm.examType) data.examType = metaForm.examType;
      if (metaForm.totalScore) data.totalScore = parseInt(metaForm.totalScore);
      if (metaForm.duration) data.duration = parseInt(metaForm.duration);
      await updatePaper(token, editMetaPaper.id, data);
      setMessage('元数据已更新');
      setEditMetaPaper(null);
      await loadPapers();
    } catch (e: any) {
      setError(e.message || '保存失败');
    }
    setSavingMeta(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles(selected);
      setMessage('');
      setError('');
      setMultiResults([]);
    }
  };

  const handleImport = async () => {
    await runImport(files, importSubjectId);
  };

  // Shared import executor (used by single-file, multi-file and folder import)
  const runImport = async (fileList: File[], subjectId?: number | null) => {
    if (fileList.length === 0) {
      setError('请选择文件');
      return;
    }
    if (!token) {
      setError('请先登录');
      return;
    }

    setImporting(true);
    setError('');
    setMessage('');
    setMultiResults([]);

    try {
      if (fileList.length === 1) {
        // Single file — use original import endpoint
        const file = fileList[0];
        let result;
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          result = await importFromPDF(token, file, subjectId);
        } else if (file.type.startsWith('image/')) {
          result = await importFromImage(token, file, subjectId);
        } else {
          result = await importFromPDF(token, file, subjectId);
        }

        if (result.success && result.paper) {
          let msg = `试卷导入成功: ${result.paper.title}`;
          const parser = (result as any).parserUsed || 'unknown';
          if (parser === 'mineru') {
            msg += '（MinerU解析，数学公式已转为LaTeX，自动打标签完成）';
          } else if (parser === 'pdfjs') {
            msg += '（纯文本提取，数学公式可能丢失）';
          }
          setMessage(msg);
          setFiles([]);
          await loadPapers();
        } else {
          setError(result.error || '导入失败');
        }
      } else {
        // Multi-file — use import-multiple endpoint
        const result = await importMultipleFiles(token, fileList, subjectId);
        if (result.success && result.results) {
          setMultiResults(result.results);
          const successCount = result.results.filter(r => r.success).length;
          setMessage(`多文件导入完成: ${successCount}/${fileList.length} 成功`);
          setFiles([]);
          await loadPapers();
        } else {
          setError('多文件导入失败');
        }
      }
    } catch (e: any) {
      setError(e.message || '导入失败');
    }

    setImporting(false);
  };

  const handleDelete = async (paperId: number) => {
    if (!token) return;
    if (!confirm('确定要删除这份试卷吗？')) return;
    try {
      await deletePaper(token, paperId);
      await loadPapers();
      setMessage('删除成功');
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  };

  const loadPapers = async () => {
    if (!token) return;
    try {
      const data = await getPapers(token);
      const all = Array.isArray(data) ? data : (data as any)?.data || [];
      // 题库管理仅展示拆分来源试卷（整卷试卷归「试卷库」管理）
      setPapers(all.filter((p: Paper) => (p as any).purpose !== 'whole_paper'));
    } catch (e) {
      console.error('Failed to load papers:', e);
    }
  };

  useEffect(() => {
    if (token) loadPapers();
  }, [token]);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待处理',
      published: '已发布',
    };
    return map[status] || status;
  };

  const getStatusClass = (status: string) => `status-${status}`;

  return (
    <div className="paper-import-container">
      <h1>题库管理</h1>
      <p className="hint">拆分导入：上传试卷 → MinerU 解析 → 编辑校准 → 按题拆分入库。整卷试卷请前往「试卷库」管理。</p>

      <div className="import-section">
        <h2>上传试卷（拆分导入）</h2>
        <p className="hint">支持指定单个文件或多个文件批量导入。格式: PDF、图片（JPG/PNG）、Word（.docx/.doc）、文本（.txt）</p>
        <p className="hint">导入后不会自动跳转编辑器，请在下方列表中手动点击"编辑校准"。</p>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".pdf,image/*,.docx,.doc,.txt"
            onChange={handleFileChange}
            id="file-input"
            multiple
          />
          <label htmlFor="file-input" className="file-label">
            {files.length > 0 ? `已选择 ${files.length} 个文件: ${files.map(f => f.name).join(', ')}` : '选择文件（可多选）'}
          </label>
        </div>

        <div className="import-subject-row">
          <label>所属学科：</label>
          <SubjectSelect value={importSubjectId} onChange={setImportSubjectId} />
          <span className="hint">导入的试卷与拆分出的题目将归入所选学科</span>
        </div>

        <button
          onClick={handleImport}
          disabled={files.length === 0 || importing}
          className="btn-primary"
        >
          {importing ? '导入中（MinerU解析约2分钟/文件）...' : files.length > 1 ? `批量导入 ${files.length} 个文件` : '导入试卷'}
        </button>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        {multiResults.length > 0 && (
          <div className="multi-results">
            <h3>导入结果</h3>
            <table className="results-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>状态</th>
                  <th>试卷ID</th>
                  <th>解析器</th>
                  <th>内容长度</th>
                  <th>数学公式</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {multiResults.map((r, i) => (
                  <tr key={i}>
                    <td title={r.fileName}>{r.fileName}</td>
                    <td>{r.success ? '✅ 成功' : '❌ 失败'}</td>
                    <td>{r.paperId || '-'}</td>
                    <td>{r.parserUsed || '-'}</td>
                    <td>{r.contentLength || 0}</td>
                    <td>{r.hasMathContent ? '是' : '否'}</td>
                    <td>
                      {r.success && r.paperId && (
                        <button className="btn-small" onClick={() => navigate(`/papers/${r.paperId}/edit`)}>
                          编辑校准
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="papers-list">
        <h2>已导入试卷</h2>
        {papers.length === 0 ? (
          <p className="empty">暂无试卷</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>标题</th>
                <th>来源</th>
                <th>格式</th>
                <th>年份</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.id}>
                  <td>
                    <div className="paper-title-cell">{paper.title}</div>
                    <div className="paper-meta-line">
                      {paper.examType || '-'} · {paper.region || '-'}
                      {paper.totalScore ? ` · ${paper.totalScore}分` : ''}
                      {paper.duration ? ` · ${paper.duration}分钟` : ''}
                    </div>
                  </td>
                  <td>{paper.source}</td>
                  <td>{paper.sourceFormat || '-'}</td>
                  <td>{paper.year}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(paper.status)}`}>
                      {getStatusText(paper.status)}
                    </span>
                  </td>
                  <td className="actions">
                    <button onClick={() => navigate(`/papers/${paper.id}/edit`)} className="btn-small">
                      编辑校准
                    </button>
                    <button onClick={() => navigate(`/papers/${paper.id}/split-preview`)} className="btn-small">
                      预览拆分
                    </button>
                    {paper.editedMarkdown && (
                      <button onClick={() => navigate(`/papers/${paper.id}/split-preview`)} className="btn-small">
                        确认导入
                      </button>
                    )}
                    <button onClick={() => handleEditMeta(paper)} className="btn-small">
                      元数据
                    </button>
                    <button onClick={() => handleDelete(paper.id)} className="btn-small btn-danger">
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editMetaPaper && (
        <div className="meta-modal-overlay" onClick={() => setEditMetaPaper(null)}>
          <div className="meta-modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑元数据</h3>
            <p className="meta-modal-hint">导入时已自动提取，可在此手工修改</p>
            <div className="meta-form">
              <div className="meta-form-row">
                <label>标题</label>
                <input type="text" value={metaForm.title} onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })} />
              </div>
              <div className="meta-form-row">
                <label>来源</label>
                <input type="text" value={metaForm.source} onChange={(e) => setMetaForm({ ...metaForm, source: e.target.value })} />
              </div>
              <div className="meta-form-row">
                <label>年份</label>
                <input type="number" value={metaForm.year} onChange={(e) => setMetaForm({ ...metaForm, year: e.target.value })} placeholder="如 2026" />
              </div>
              <div className="meta-form-row">
                <label>地区</label>
                <input type="text" value={metaForm.region} onChange={(e) => setMetaForm({ ...metaForm, region: e.target.value })} placeholder="如 全国" />
              </div>
              <div className="meta-form-row">
                <label>考试类型</label>
                <input type="text" value={metaForm.examType} onChange={(e) => setMetaForm({ ...metaForm, examType: e.target.value })} placeholder="如 高考/期中/期末" />
              </div>
              <div className="meta-form-row">
                <label>总分</label>
                <input type="number" value={metaForm.totalScore} onChange={(e) => setMetaForm({ ...metaForm, totalScore: e.target.value })} placeholder="如 150" />
              </div>
              <div className="meta-form-row">
                <label>时长(分钟)</label>
                <input type="number" value={metaForm.duration} onChange={(e) => setMetaForm({ ...metaForm, duration: e.target.value })} placeholder="如 120" />
              </div>
            </div>
            <div className="meta-modal-actions">
              <button className="btn-small" onClick={() => setEditMetaPaper(null)}>取消</button>
              <button className="btn-small btn-primary" onClick={handleSaveMeta} disabled={savingMeta}>
                {savingMeta ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
