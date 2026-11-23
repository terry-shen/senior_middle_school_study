import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getDirectories, directoryAction, getSectionConvergence, undoBatch,
  batchAction, getIndexStats, getScanStatus, listAssets, pauseScan, remapAssets, startScan,
  getLibraryTree, listLibraryAssets, moveLibraryCategory,
} from '../services/netdisk-index-api';
import type {
  AssetRow, AssetVisibility, BatchAction, DirectoryStat, SectionConvergence,
  LibraryTreeSubject, LibraryAssetRow,
} from '../services/netdisk-index-api';
import { getTaxonomyTree, createSection, createChapter } from '../services/chapters-api';
import type { TextbookNode } from '../services/chapters-api';
import { getSubjects } from '../services/subjects-api';
import type { Subject } from '../services/subjects-api';
import './NetdiskMapping.css';

const KIND_LABEL: Record<string, string> = {
  video: '视频', audio: '音频', image: '图片', ppt: '课件', answer: '答案',
  practice: '练习', exam: '试卷', plan: '讲义', lecture: '讲义', other: '其他', junk: '垃圾',
};
const AUD_LABEL: Record<string, string> = { student: '学生', teacher: '教师', both: '通用' };
const VIS_LABEL: Record<AssetVisibility, string> = {
  visible: '✅ 可见', unmapped: '⚠ 未挂载', unconfirmed: '⬜ 未确认',
  teacher: '🚫 教师资源', archived: '🚫 已归档', ignored: '🚫 已屏蔽',
};

type Tab = 'convergence' | 'inbox' | 'library' | 'directories' | 'advanced';

interface TreeGroup { id: number; icon: string; name: string; books: TextbookNode[] }

function groupTaxonomy(books: TextbookNode[]): TreeGroup[] {
  const map = new Map<number, TreeGroup>();
  for (const b of books) {
    const id = b.subjectId ?? 0;
    if (!map.has(id)) map.set(id, { id, icon: b.subjectIcon ?? '📘', name: b.subjectName ?? '未分学科', books: [] });
    map.get(id)!.books.push(b);
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    const orderOf = (g: TreeGroup) => Math.min(...g.books.map(x => x.order ?? 999));
    return orderOf(a) - orderOf(b);
  });
  return groups;
}

function visibilityOf(a: AssetRow): AssetVisibility {
  return a.visibility ?? 'unmapped';
}

export default function NetdiskMapping() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('convergence');
  const [stats, setStats] = useState<{ total: number; mapped: number; unmapped: number; pinned: number; byLine: { section: number; video: number; library: number; unassigned: number } } | null>(null);
  const [scan, setScan] = useState<{ status: string; scannedDirs: number; totalFiles: number } | null>(null);
  const [remapping, setRemapping] = useState(false);
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState<{ token: string; label: string } | null>(null);
  const undoTimer = useRef<number | null>(null);

  const [books, setBooks] = useState<TextbookNode[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [openBooks, setOpenBooks] = useState<number[]>([]);
  const [openChapters, setOpenChapters] = useState<number[]>([]);

  const flash = useCallback((text: string, undoToken?: string | null) => {
    setMessage(text);
    if (undoToken) {
      setUndo({ token: undoToken, label: text });
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
    }
  }, []);

  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);

  const loadHeader = useCallback(async () => {
    if (!token) return;
    try {
      const [s, sc] = await Promise.all([getIndexStats(token), getScanStatus(token)]);
      setStats({ total: s.total, mapped: s.mapped, unmapped: s.unmapped, pinned: s.pinned, byLine: s.byLine });
      setScan(sc.status);
    } catch { /* 头信息失败不阻塞 */ }
  }, [token]);

  const loadTaxonomy = useCallback(async () => {
    if (!token) return;
    try {
      const [tree, subs] = await Promise.all([getTaxonomyTree(token), getSubjects()]);
      setBooks(tree);
      setSubjects(subs.filter(s => s.isActive !== false));
    } catch (e) { flash(e instanceof Error ? e.message : '教材加载失败'); }
  }, [token, flash]);

  useEffect(() => { loadHeader(); loadTaxonomy(); }, [loadHeader, loadTaxonomy]);
  useEffect(() => {
    if (scan?.status !== 'running') return;
    const t = window.setInterval(loadHeader, 3000);
    return () => window.clearInterval(t);
  }, [scan?.status, loadHeader]);

  const treeGroups = useMemo(() => groupTaxonomy(books), [books]);

  const toggleBook = (id: number) => setOpenBooks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleChapter = (id: number) => setOpenChapters(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  async function handleScan(restart: boolean) {
    if (!token) return;
    try { await startScan(token, restart); flash(restart ? '已开始全量重扫' : '已开始扫描'); loadHeader(); }
    catch (e) { flash(e instanceof Error ? e.message : '扫描失败'); }
  }
  async function handlePause() {
    if (!token) return;
    try { await pauseScan(token); flash('已暂停'); loadHeader(); }
    catch (e) { flash(e instanceof Error ? e.message : '暂停失败'); }
  }
  async function handleRemap() {
    if (!token) return;
    setRemapping(true);
    try {
      const r = await remapAssets(token);
      flash(`重新映射完成：扫描 ${r.scanned} 条，确认 ${r.mapped} 条，覆盖 ${r.perSection} 节`);
      loadHeader();
    } catch (e) { flash(e instanceof Error ? e.message : '重新映射失败'); }
    finally { setRemapping(false); }
  }
  async function handleUndo() {
    if (!token || !undo) return;
    try { const r = await undoBatch(token, undo.token); flash(`已撤销，恢复 ${r.restored} 条`); setUndo(null); loadHeader(); }
    catch (e) { flash(e instanceof Error ? e.message : '撤销失败'); }
  }

  return (
    <div className="nm-page">
      <div className="nm-head">
        <div>
          <h1>🗃️ 资源映射工作台</h1>
          <p className="nm-sub">全部学科 ｜ 网盘索引 → 章节映射 → 精选收敛</p>
        </div>
        <div className="nm-head-actions">
          <span className={`nm-chip nm-chip-${scan?.status ?? 'idle'}`}>
            {scan ? `${scan.status === 'running' ? '扫描中' : scan.status === 'done' ? '已完成' : scan.status === 'paused' ? '已暂停' : scan.status} · 已扫 ${scan.scannedDirs} 目录 / ${scan.totalFiles} 文件` : '未扫描'}
          </span>
          <button className="nm-btn nm-btn-primary" onClick={() => handleScan(false)} disabled={scan?.status === 'running'}>开始扫描</button>
          <button className="nm-btn" onClick={() => handleScan(true)}>重新扫描</button>
          <button className="nm-btn" onClick={handlePause} disabled={scan?.status !== 'running'}>暂停</button>
          <button className="nm-btn" onClick={handleRemap} disabled={remapping}>{remapping ? '映射中…' : '重新自动映射'}</button>
        </div>
      </div>

      {stats && (
        <div className="nm-stats">
          <div className="nm-stat"><b>{stats.total}</b><span>索引总数</span></div>
          <div className="nm-stat"><b>{stats.byLine.section}</b><span>教材小节</span></div>
          <div className="nm-stat"><b>{stats.byLine.library}</b><span>教辅资源线</span></div>
          <div className="nm-stat"><b>{stats.byLine.video}</b><span>视频主线</span></div>
          <div className="nm-stat"><b>{stats.unmapped}</b><span>未归主线</span></div>
          <div className="nm-stat"><b>{stats.pinned}</b><span>已精选</span></div>
        </div>
      )}

      <div className="nm-tabs">
        {([
          ['convergence', '① 单节收敛'],
          ['inbox', '② 未挂小节收件箱'],
          ['library', '③ 教辅资源映射'],
          ['directories', '④ 目录清理'],
          ['advanced', '⑤ 高级表格'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} className={`nm-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {message && <div className="nm-message" onClick={() => setMessage('')}>{message}</div>}

      {tab === 'convergence' && (
        <ConvergenceView token={token} treeGroups={treeGroups} openBooks={openBooks} openChapters={openChapters}
          toggleBook={toggleBook} toggleChapter={toggleChapter} flash={flash} onChanged={loadHeader} />
      )}
      {tab === 'inbox' && <InboxView token={token} books={books} subjects={subjects} reloadTaxonomy={loadTaxonomy} flash={flash} onChanged={loadHeader} />}
      {tab === 'library' && <LibraryMappingView token={token} flash={flash} onChanged={loadHeader} />}
      {tab === 'directories' && <DirectoriesView token={token} flash={flash} onChanged={loadHeader} />}
      {tab === 'advanced' && (
        <AdvancedView token={token} treeGroups={treeGroups} openBooks={openBooks} openChapters={openChapters}
          toggleBook={toggleBook} toggleChapter={toggleChapter} flash={flash} onChanged={loadHeader} />
      )}

      {undo && (
        <div className="nm-undo">
          <span>{undo.label}</span>
          <button className="nm-btn nm-btn-primary" onClick={handleUndo}>撤销</button>
          <button className="nm-btn" onClick={() => setUndo(null)}>关闭</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- ① 单节收敛 ---------------- */

function ConvergenceView(props: {
  token: string | null; treeGroups: TreeGroup[]; openBooks: number[]; openChapters: number[];
  toggleBook: (id: number) => void; toggleChapter: (id: number) => void;
  flash: (text: string, undoToken?: string | null) => void; onChanged: () => void;
}) {
  const { token, treeGroups, openBooks, openChapters, toggleBook, toggleChapter, flash, onChanged } = props;
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SectionConvergence | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!token || sectionId == null) return;
    setLoading(true);
    try { setDetail(await getSectionConvergence(token, sectionId)); }
    catch (e) { flash(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [token, sectionId, flash]);

  useEffect(() => { setPicked([]); load(); }, [load]);

  async function act(ids: number[], action: BatchAction, withSection?: number | null) {
    if (!token || !ids.length) return;
    try {
      const r = await batchAction(token, ids, action, withSection ?? null);
      flash(`${actionLabel(action)}：${r.affected} 条`, r.undoToken);
      setPicked([]);
      await load();
      onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '操作失败'); }
  }

  const metrics = detail?.metrics;

  return (
    <div className="nm-layout nm-layout-conv">
      <aside className="nm-tree">
        <div className="nm-pane-head">选择小节</div>
        {treeGroups.map(g => (
          <div key={g.id} className="nm-subject">
            <div className="nm-subject-head">{g.icon} {g.name}<span className="nm-subject-count">{g.books.length} 册</span></div>
            {g.books.map(book => (
              <div key={book.id} className="nm-book">
                <button className="nm-book-head" onClick={() => toggleBook(book.id)}>{openBooks.includes(book.id) ? '▾' : '▸'} {book.name}</button>
                {openBooks.includes(book.id) && book.chapters.map(ch => (
                  <div key={ch.id} className="nm-chapter">
                    <button className="nm-chapter-head" onClick={() => toggleChapter(ch.id)}>{openChapters.includes(ch.id) ? '▾' : '▸'} {ch.order}. {ch.title}</button>
                    {openChapters.includes(ch.id) && ch.sections.map(sec => (
                      <button key={sec.id} className={`nm-section ${sectionId === sec.id ? 'active' : ''}`} onClick={() => setSectionId(sec.id)}>
                        {sec.order}. {sec.title}<span className="nm-count">{sec.resourceCount}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </aside>

      <section className="nm-main">
        {sectionId == null && <div className="nm-empty-box">左侧选择一个小节开始收敛</div>}
        {sectionId != null && loading && <div className="nm-empty-box">加载中…</div>}
        {sectionId != null && detail && (
          <>
            <div className="nm-conv-head">
              <div>
                <h2>{detail.section.title}</h2>
                <p className="nm-sub">{detail.section.textbookName} / {detail.section.chapterTitle}</p>
              </div>
              <div className={`nm-lamp ${metrics?.ok ? 'ok' : 'warn'}`}>
                {metrics?.ok ? '● 达标' : '● 未达标'}
                <span>精选 {metrics?.pinned ?? 0} / 可用 {metrics?.visible ?? 0} / 更多 {metrics?.more ?? 0}</span>
              </div>
            </div>

            <div className="nm-conv-block">
              <div className="nm-pane-head">待加入本节（候选 {detail.candidates.length}）</div>
              {detail.candidates.length === 0 && <div className="nm-empty-inline">没有更多匹配的候选资源，可到「未映射收件箱」手动挂载</div>}
              {detail.candidates.map(c => (
                <label key={c.id} className="nm-cand">
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} />
                  <span className="nm-cand-name" title={c.path}>{c.name}</span>
                  <span className="nm-badge">{KIND_LABEL[c.assetKind] ?? c.assetKind}</span>
                  <span className="nm-reason">{c.reason.join(' / ') || '相近'}</span>
                  <span className="nm-score">{c.score}</span>
                </label>
              ))}
              {detail.candidates.length > 0 && (
                <div className="nm-row-actions">
                  <button className="nm-btn nm-btn-primary" disabled={!picked.length} onClick={() => act(picked, 'move', sectionId)}>加入本节（{picked.length}）</button>
                </div>
              )}
            </div>

            <div className="nm-conv-block">
              <div className="nm-pane-head">本节已有资源（{detail.mapped.length}）</div>
              {detail.mapped.length === 0 && <div className="nm-empty-inline">本节还没有任何资源</div>}
              {detail.mapped.map(m => (
                <div key={m.id} className="nm-mapped">
                  <span className="nm-cand-name" title={m.path}>{m.isPinned ? '★ ' : ''}{m.name}</span>
                  <span className="nm-badge">{KIND_LABEL[m.assetKind] ?? m.assetKind}</span>
                  <span className={`nm-vis nm-vis-${visibilityOf(m)}`}>{VIS_LABEL[visibilityOf(m)]}</span>
                  <span className="nm-row-actions">
                    {m.isPinned
                      ? <button className="nm-btn nm-btn-xs" onClick={() => act([m.id], 'unpin')}>取消精选</button>
                      : <button className="nm-btn nm-btn-xs" onClick={() => act([m.id], 'pin')}>设为精选</button>}
                    <button className="nm-btn nm-btn-xs" onClick={() => act([m.id], 'archive')}>归档</button>
                    <button className="nm-btn nm-btn-xs nm-btn-danger" onClick={() => { if (confirm(`解除「${m.name}」与本节的关系？`)) act([m.id], 'unmap'); }}>解除映射</button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <aside className="nm-preview">
        <div className="nm-pane-head">学生端预览</div>
        {!detail && <div className="nm-empty-inline">选择小节后显示</div>}
        {detail && (
          <>
            {detail.preview.groups.filter(g => g.items.length > 0).map(g => (
              <div key={g.key} className="nm-prev-group">
                <div className="nm-prev-title">{g.label}（{g.items.length}）</div>
                {g.items.map(i => <div key={i.id} className="nm-prev-item">▶ {i.name}</div>)}
              </div>
            ))}
            {detail.preview.groups.every(g => g.items.length === 0) && <div className="nm-empty-inline">学生端暂无精选资源</div>}
            <div className="nm-prev-more">更多资源：{detail.preview.moreCount} 条</div>
            <p className="nm-hint">预览与学生端接口同源；改动后即时刷新。</p>
          </>
        )}
      </aside>
    </div>
  );
}

/* ---------------- ② 未映射收件箱 ---------------- */

function InboxView(props: {
  token: string | null; books: TextbookNode[]; subjects: Subject[]; reloadTaxonomy: () => Promise<void> | void;
  flash: (t: string, u?: string | null) => void; onChanged: () => void;
}) {
  const { token, books, subjects, reloadTaxonomy, flash, onChanged } = props;
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [includeTeacher, setIncludeTeacher] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [target, setTarget] = useState('');
  const [libSeries, setLibSeries] = useState('');
  const [libBook, setLibBook] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await listAssets(token, {
        unmapped: true, status: 'active', q: q || undefined, assetKind: kind || undefined,
        subjectCode: subjectCode || undefined,
        audienceGroup: includeTeacher ? undefined : 'student',
        page, limit: 50,
      });
      setRows(r.data);
      setTotal(r.pagination.total);
    } catch (e) { flash(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [token, q, kind, subjectCode, includeTeacher, page, flash]);

  useEffect(() => { setPicked([]); load(); }, [load]);

  async function act(action: BatchAction) {
    if (!token || !picked.length) return;
    if (action === 'ignore' && !confirm(`屏蔽 ${picked.length} 条资源？学生端与后续自动映射都会忽略。`)) return;
    const sectionId = action === 'move' ? Number(target) : null;
    if (action === 'move' && !sectionId) { flash('请先选择目标小节'); return; }
    if (action === 'library' && !libSeries.trim() && !libBook.trim()) { flash('请填写教辅系列或书目'); return; }
    try {
      const r = await batchAction(token, picked, action, sectionId, action === 'library' ? { series: libSeries, book: libBook } : undefined);
      flash(`${actionLabel(action)}：${r.affected} 条`, r.undoToken);
      setPicked([]);
      await load();
      onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '操作失败'); }
  }

  const subjectName = (code?: string | null) => subjects.find(s => s.code === code)?.name ?? '未识别';

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="nm-inbox">
      <div className="nm-filters">
        <select value={subjectCode} onChange={e => { setSubjectCode(e.target.value); setPage(1); }}>
          <option value="">全部学科（自动识别）</option>
          {subjects.map(s => <option key={s.code} value={s.code}>{s.icon} {s.name}</option>)}
        </select>
        <input placeholder="关键词" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}>
          <option value="">全部类型</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="nm-check"><input type="checkbox" checked={includeTeacher} onChange={e => { setIncludeTeacher(e.target.checked); setPage(1); }} /> 含教师资源</label>
        <button className="nm-btn" onClick={load}>刷新</button>
        <span className="nm-total">共 {total} 条</span>
      </div>

      {picked.length > 0 && (
        <div className="nm-batchbar">
          <span>已选 {picked.length} 条</span>
          <select value={target} onChange={e => setTarget(e.target.value)}>
            <option value="">选择目标小节…</option>
            {subjects.map(s => {
              const subjBooks = books.filter(b => b.subjectId === s.id);
              if (!subjBooks.length) return null;
              return (
                <optgroup key={s.id} label={`${s.icon} ${s.name}`}>
                  {subjBooks.flatMap(b => {
                    if (b.chapters.length === 0) {
                      return [<option key={`b-${b.id}`} value="" disabled>{b.name}（暂无章节，请用「＋ 新建小节」补建）</option>];
                    }
                    return b.chapters.flatMap(ch => {
                      if (ch.sections.length === 0) {
                        return [<option key={`c-${ch.id}`} value="" disabled>{b.name} / {ch.title}（无小节）</option>];
                      }
                      return ch.sections.map(sec => (
                        <option key={sec.id} value={sec.id}>{b.name} / {ch.title} / {sec.title}</option>
                      ));
                    });
                  })}
                </optgroup>
              );
            })}
          </select>
          <button className="nm-btn" onClick={() => setCreateOpen(true)}>＋ 新建小节</button>
          <button className="nm-btn nm-btn-primary" onClick={() => act('move')}>挂到该节</button>
          <input className="nm-inline-input" placeholder="教辅系列" value={libSeries} onChange={e => setLibSeries(e.target.value)} />
          <input className="nm-inline-input" placeholder="书目" value={libBook} onChange={e => setLibBook(e.target.value)} />
          <button className="nm-btn" onClick={() => act('library')}>归入教辅</button>
          <button className="nm-btn nm-btn-danger" onClick={() => act('ignore')}>屏蔽</button>
          <button className="nm-btn" onClick={() => setPicked([])}>清空</button>
        </div>
      )}

      <table className="nm-table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={rows.length > 0 && rows.every(r => picked.includes(r.id))} onChange={e => setPicked(e.target.checked ? rows.map(r => r.id) : [])} /></th>
            <th>资源</th><th>学科</th><th>类型</th><th>学生可见</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={picked.includes(r.id) ? 'selected' : ''}>
              <td><input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])} /></td>
              <td className="nm-name" title={r.path}>
                <div>{r.name}</div>
                {(r.librarySeries || r.libraryBook) && (
                  <div className="nm-subline">教辅：{[r.librarySeries, r.libraryBook].filter(Boolean).join(' / ')}</div>
                )}
              </td>
              <td className={r.subjectCode ? '' : 'nm-cap'}>{subjectName(r.subjectCode)}</td>
              <td>{KIND_LABEL[r.assetKind] ?? r.assetKind}</td>
              <td><span className={`nm-vis nm-vis-${visibilityOf(r)}`}>{VIS_LABEL[visibilityOf(r)]}</span></td>
            </tr>
          ))}
          {rows.length === 0 && !loading && <tr><td colSpan={5} className="nm-empty">没有匹配的未映射资源</td></tr>}
        </tbody>
      </table>

      <div className="nm-pager">
        <button className="nm-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page} / {totalPages}</span>
        <button className="nm-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
      </div>

      {createOpen && (
        <CreateSectionModal
          token={token} books={books} subjects={subjects}
          onClose={() => setCreateOpen(false)}
          onCreated={async (newId, label) => {
            setCreateOpen(false);
            await reloadTaxonomy();
            setTarget(String(newId));
            flash(`已创建小节：${label}，可直接挂载`);
          }}
          onError={(msg) => flash(msg)}
        />
      )}
    </div>
  );
}

function CreateSectionModal(props: {
  token: string | null; books: TextbookNode[]; subjects: Subject[];
  onClose: () => void; onCreated: (id: number, label: string) => void; onError: (msg: string) => void;
}) {
  const { token, books, subjects, onClose, onCreated, onError } = props;
  const firstSubjectId = books[0]?.subjectId ?? subjects[0]?.id ?? 0;
  const [subjectId, setSubjectId] = useState<number>(firstSubjectId);
  const subjBooks = books.filter(b => b.subjectId === subjectId);
  const [bookId, setBookId] = useState<number>(subjBooks[0]?.id ?? 0);
  const chapters = subjBooks.find(b => b.id === bookId)?.chapters ?? [];
  const [chapterId, setChapterId] = useState<number>(chapters[0]?.id ?? 0);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bs = books.filter(b => b.subjectId === subjectId);
    setBookId(bs[0]?.id ?? 0);
  }, [subjectId, books]);

  useEffect(() => {
    const chs = books.find(b => b.id === bookId)?.chapters ?? [];
    setChapterId(chs[0]?.id ?? 0);
  }, [bookId, books]);

  async function submit() {
    if (!token) return;
    if (!bookId) { onError('请先选择教材'); return; }
    if (!chapterId && !newChapterTitle.trim()) { onError('该教材暂无章节，请填写新章节名称'); return; }
    if (!title.trim()) { onError('请填写小节名称'); return; }
    setBusy(true);
    try {
      let targetChapterId = chapterId;
      if (!targetChapterId) {
        const createdChapter = await createChapter(token, { textbookId: bookId, title: newChapterTitle.trim() });
        const cid = Number(
          (createdChapter as { chapter?: { id?: number }; data?: { id?: number }; id?: number })?.chapter?.id
          ?? (createdChapter as { data?: { id?: number } })?.data?.id
          ?? (createdChapter as { id?: number })?.id,
        );
        if (!Number.isFinite(cid) || cid <= 0) { onError('章节创建失败，请重试'); return; }
        targetChapterId = cid;
      }
      const created = await createSection(token, { chapterId: targetChapterId, title: title.trim() });
      const rawId = Number(
        (created as { section?: { id?: number }; data?: { id?: number }; id?: number })?.section?.id
        ?? (created as { data?: { id?: number } })?.data?.id
        ?? (created as { id?: number })?.id,
      );
      const book = books.find(b => b.id === bookId);
      const chapter = book?.chapters.find(ch => ch.id === targetChapterId);
      const chapterLabel = chapter?.title ?? newChapterTitle.trim();
      onCreated(Number.isFinite(rawId) ? rawId : 0, `${book?.name ?? ''} / ${chapterLabel} / ${title.trim()}`);
    } catch (e) { onError(e instanceof Error ? e.message : '创建小节失败'); }
    finally { setBusy(false); }
  }

  return (
    <div className="nm-modal-mask" onClick={onClose}>
      <div className="nm-modal" onClick={e => e.stopPropagation()}>
        <h3>新建教材小节</h3>
        <p className="nm-hint">当资源无法归入现有章节时，可先在这里补一个小节，再挂载资源。</p>
        <label className="nm-form-row">
          <span>学科</span>
          <select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </label>
        <label className="nm-form-row">
          <span>教材</span>
          <select value={bookId} onChange={e => setBookId(Number(e.target.value))}>
            {subjBooks.length === 0 && <option value={0}>该学科暂无教材</option>}
            {subjBooks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="nm-form-row">
          <span>章节</span>
          {chapters.length === 0 ? (
            <input
              value={newChapterTitle}
              onChange={e => setNewChapterTitle(e.target.value)}
              placeholder="该教材还没有章节，直接输入章节名（如：综合复习）"
            />
          ) : (
            <select value={chapterId} onChange={e => setChapterId(Number(e.target.value))}>
              {chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.order}. {ch.title}</option>)}
            </select>
          )}
        </label>
        <label className="nm-form-row">
          <span>小节名称</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：4.6 三角函数模型的简单应用" />
        </label>
        <div className="nm-modal-actions">
          <button className="nm-btn" onClick={onClose} disabled={busy}>取消</button>
          <button className="nm-btn nm-btn-primary" onClick={submit} disabled={busy}>{busy ? '创建中…' : '创建小节'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ③ 目录清理 ---------------- */

function DirectoriesView(props: { token: string | null; flash: (t: string, u?: string | null) => void; onChanged: () => void }) {
  const { token, flash, onChanged } = props;
  const [dirs, setDirs] = useState<DirectoryStat[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setDirs((await getDirectories(token)).data); }
    catch (e) { flash(e instanceof Error ? e.message : '加载目录失败'); }
    finally { setLoading(false); }
  }, [token, flash]);

  useEffect(() => { load(); }, [load]);

  async function act(d: DirectoryStat, action: 'archive' | 'ignore' | 'restore') {
    if (!token) return;
    const label = action === 'archive' ? '归档' : action === 'ignore' ? '屏蔽' : '恢复';
    if (action !== 'restore' && !confirm(`对「${d.name}」整目录执行${label}？共 ${d.total} 条资源。`)) return;
    try {
      const r = await directoryAction(token, d.dir, action);
      flash(`目录${label}：${r.affected} 条`, r.undoToken);
      await load();
      onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '目录操作失败'); }
  }

  return (
    <div className="nm-dirs">
      <div className="nm-dirs-head">
        <span className="nm-hint">按目录一键收敛旧版教辅；归档可恢复，屏蔽后不再参与自动映射。</span>
        <button className="nm-btn" onClick={load} disabled={loading}>{loading ? '加载中…' : '刷新'}</button>
      </div>
      {dirs.map(d => (
        <div key={d.dir} className="nm-dir">
          <div className="nm-dir-main">
            <div className="nm-dir-name" title={d.dir}>📁 {d.name}</div>
            <div className="nm-dir-meta">
              <b>{d.total}</b> 条 · 教师 {d.teacher} · 学生/通用 {d.studentOrBoth}
              {Object.entries(d.kinds).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => (
                <span key={k} className="nm-badge">{KIND_LABEL[k] ?? k} {v}</span>
              ))}
            </div>
          </div>
          <div className="nm-dir-actions">
            <button className="nm-btn" onClick={() => act(d, 'archive')}>整目录归档</button>
            <button className="nm-btn nm-btn-danger" onClick={() => act(d, 'ignore')}>整目录屏蔽</button>
            <button className="nm-btn" onClick={() => act(d, 'restore')}>恢复</button>
          </div>
        </div>
      ))}
      {dirs.length === 0 && !loading && <div className="nm-empty-box">暂无目录数据</div>}
    </div>
  );
}

/* ---------------- ④ 高级表格 ---------------- */

function AdvancedView(props: {
  token: string | null; treeGroups: TreeGroup[]; openBooks: number[]; openChapters: number[];
  toggleBook: (id: number) => void; toggleChapter: (id: number) => void;
  flash: (t: string, u?: string | null) => void; onChanged: () => void;
}) {
  const { token, treeGroups, openBooks, openChapters, toggleBook, toggleChapter, flash, onChanged } = props;
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unmapped, setUnmapped] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [audience, setAudience] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [showMore, setShowMore] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await listAssets(token, {
        unmapped: unmapped || undefined, sectionId: sectionId ?? undefined,
        q: q || undefined, assetKind: kind || undefined, audience: audience || undefined,
        page, limit: 50,
      });
      setRows(r.data); setTotal(r.pagination.total);
    } catch (e) { flash(e instanceof Error ? e.message : '加载失败'); }
  }, [token, unmapped, sectionId, q, kind, audience, page, flash]);

  useEffect(() => { setPicked([]); load(); }, [load]);

  async function act(action: BatchAction) {
    if (!token || !picked.length) return;
    if ((action === 'ignore' || action === 'unmap') && !confirm(`${actionLabel(action)} ${picked.length} 条资源？`)) return;
    try {
      const r = await batchAction(token, picked, action, sectionId);
      flash(`${actionLabel(action)}：${r.affected} 条`, r.undoToken);
      setPicked([]); await load(); onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '操作失败'); }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="nm-layout">
      <aside className="nm-tree">
        <div className="nm-pane-head">章节树</div>
        <button className={`nm-tree-item ${unmapped ? 'active' : ''}`} onClick={() => { setUnmapped(true); setSectionId(null); setPage(1); }}>仅未挂小节</button>
        {treeGroups.map(g => (
          <div key={g.id} className="nm-subject">
            <div className="nm-subject-head">{g.icon} {g.name}<span className="nm-subject-count">{g.books.length} 册</span></div>
            {g.books.map(book => (
              <div key={book.id} className="nm-book">
                <button className="nm-book-head" onClick={() => toggleBook(book.id)}>{openBooks.includes(book.id) ? '▾' : '▸'} {book.name}</button>
                {openBooks.includes(book.id) && book.chapters.map(ch => (
                  <div key={ch.id} className="nm-chapter">
                    <button className="nm-chapter-head" onClick={() => toggleChapter(ch.id)}>{openChapters.includes(ch.id) ? '▾' : '▸'} {ch.order}. {ch.title}</button>
                    {openChapters.includes(ch.id) && ch.sections.map(sec => (
                      <button key={sec.id} className={`nm-section ${!unmapped && sectionId === sec.id ? 'active' : ''}`}
                        onClick={() => { setUnmapped(false); setSectionId(sec.id); setPage(1); }}>
                        {sec.order}. {sec.title}<span className="nm-count">{sec.resourceCount}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </aside>

      <section className="nm-main">
        <div className="nm-filters">
          <input placeholder="关键词" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          <select value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}>
            <option value="">全部类型</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={audience} onChange={e => { setAudience(e.target.value); setPage(1); }}>
            <option value="">全部对象</option>
            <option value="student">学生</option>
            <option value="teacher">教师</option>
            <option value="both">通用</option>
          </select>
          <button className="nm-btn" onClick={load}>刷新</button>
          <span className="nm-total">共 {total} 条</span>
        </div>

        <table className="nm-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={rows.length > 0 && rows.every(r => picked.includes(r.id))} onChange={e => setPicked(e.target.checked ? rows.map(r => r.id) : [])} /></th>
              <th>文件名</th><th>类型</th><th>对象</th><th>章节</th><th>学生可见</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className={picked.includes(a.id) ? 'selected' : ''}>
                <td><input type="checkbox" checked={picked.includes(a.id)} onChange={() => setPicked(p => p.includes(a.id) ? p.filter(x => x !== a.id) : [...p, a.id])} /></td>
                <td className="nm-name" title={a.path}>{a.name}{a.isPinned && <span className="nm-pin">精选</span>}</td>
                <td>{KIND_LABEL[a.assetKind] ?? a.assetKind}</td>
                <td>{AUD_LABEL[a.audience] ?? a.audience}</td>
                <td className="nm-sec">{a.section ? a.section.title : '未映射'}</td>
                <td><span className={`nm-vis nm-vis-${visibilityOf(a)}`}>{VIS_LABEL[visibilityOf(a)]}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="nm-empty">没有匹配的资源</td></tr>}
          </tbody>
        </table>

        <div className="nm-pager">
          <button className="nm-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button className="nm-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      </section>

      <aside className="nm-actions">
        <div className="nm-pane-head">批量操作</div>
        <div className="nm-selected">已选 {picked.length} 条</div>
        <div className="nm-target">目标小节：{sectionId ?? '未选择'}</div>

        <div className="nm-act-group">
          <div className="nm-act-title">归属</div>
          <button className="nm-btn nm-btn-primary" onClick={() => act('move')}>挂到选中节</button>
          <p className="nm-act-hint">改归属并自动确认，学生端立即可见</p>
        </div>
        <div className="nm-act-group">
          <div className="nm-act-title">可见性</div>
          <button className="nm-btn" onClick={() => act('confirm')}>确认映射</button>
          <p className="nm-act-hint">仅对已挂节资源生效，让它们进入学生端</p>
        </div>
        <div className="nm-act-group">
          <div className="nm-act-title">展示</div>
          <button className="nm-btn" onClick={() => act('pin')}>设为精选</button>
          <button className="nm-btn" onClick={() => act('unpin')}>取消精选</button>
          <p className="nm-act-hint">每节最多 5 条精选</p>
        </div>
        <div className="nm-act-group">
          <div className="nm-act-title">隐藏 / 恢复</div>
          <button className="nm-btn" onClick={() => act('archive')}>归档</button>
          <button className="nm-btn" onClick={() => act('restore')}>恢复</button>
          <p className="nm-act-hint">归档：保留索引但学生不可见</p>
        </div>

        <button className="nm-more-toggle" onClick={() => setShowMore(s => !s)}>{showMore ? '收起危险操作 ▲' : '更多（危险操作）▼'}</button>
        {showMore && (
          <div className="nm-act-group nm-act-danger">
            <button className="nm-btn nm-btn-danger" onClick={() => act('ignore')}>屏蔽</button>
            <p className="nm-act-hint">学生不可见，且以后不再自动映射</p>
            <button className="nm-btn nm-btn-danger" onClick={() => act('unmap')}>解除映射</button>
            <p className="nm-act-hint">清空归属与精选，需重新挂载</p>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------------- ③ 教辅资源映射 ---------------- */

function LibraryMappingView(props: {
  token: string | null;
  flash: (t: string, u?: string | null) => void;
  onChanged: () => void;
}) {
  const { token, flash, onChanged } = props;
  const [tree, setTree] = useState<LibraryTreeSubject[]>([]);
  const [rows, setRows] = useState<LibraryAssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [series, setSeries] = useState('');
  const [book, setBook] = useState('');
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<number[]>([]);
  const [targetSeries, setTargetSeries] = useState('');
  const [targetBook, setTargetBook] = useState('');
  const [targetSubject, setTargetSubject] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTree = useCallback(async () => {
    if (!token) return;
    try {
      const r = await getLibraryTree(token);
      setTree(r.subjects || []);
    } catch (e) { flash(e instanceof Error ? e.message : '加载教辅分类失败'); }
  }, [token, flash]);

  const loadRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await listLibraryAssets(token, {
        subjectCode: subjectCode || undefined,
        series: series || undefined,
        book: book || undefined,
        q: q || undefined,
        page, limit: 50,
      });
      setRows(r.data);
      setTotal(r.pagination.total);
    } catch (e) { flash(e instanceof Error ? e.message : '加载教辅资源失败'); }
    finally { setLoading(false); }
  }, [token, subjectCode, series, book, q, page, flash]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { setPicked([]); loadRows(); }, [loadRows]);

  const choose = (code: string, s = '', b = '') => {
    setSubjectCode(code); setSeries(s); setBook(b); setPage(1);
    setTargetSubject(code); setTargetSeries(s); setTargetBook(b);
  };

  const move = async () => {
    if (!token || !picked.length) return;
    if (!targetSeries.trim() && !targetBook.trim()) { flash('请填写目标系列或书目'); return; }
    try {
      const r = await batchAction(token, picked, 'library', null, { subject: targetSubject || subjectCode, series: targetSeries, book: targetBook });
      flash(`移动 ${r.affected} 条到 ${targetSeries || '未命名系列'} / ${targetBook || '未命名书目'}`, r.undoToken);
      setPicked([]);
      await Promise.all([loadTree(), loadRows()]);
      onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '移动失败'); }
  };

  const moveCategory = async () => {
    if (!token || !subjectCode || !series) { flash('请先在左侧选中一个系列或书目'); return; }
    if (!targetSubject) { flash('请选择目标学科'); return; }
    if (!confirm(`把 ${subjectCode} / ${series}${book ? ' / ' + book : ''} 整体移动到目标分类？`)) return;
    try {
      const r = await moveLibraryCategory(token, {
        fromSubject: subjectCode,
        fromSeries: series,
        fromBook: book || undefined,
        toSubject: targetSubject,
        toSeries: targetSeries,
        toBook: targetBook,
      });
      flash(`整体移动 ${r.affected} 条`, null);
      setPicked([]);
      await Promise.all([loadTree(), loadRows()]);
      onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : '整体移动失败'); }
  };


  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="nm-libmap">
      <aside className="nm-libtree">
        <div className="nm-pane-head">教辅资源分类</div>
        <button className={`nm-tree-item ${!subjectCode ? 'active' : ''}`} onClick={() => choose('')}>全部学科</button>
        {tree.map((sub) => (
          <div key={sub.code} className="nm-subject">
            <button className={`nm-subject-head ${subjectCode === sub.code ? 'active' : ''}`} onClick={() => choose(sub.code)}>
              {sub.name}<span className="nm-subject-count">{sub.count}</span>
            </button>
            {sub.series.map((sr) => {
              const key = `${sub.code}|${sr.series}`;
              return (
                <div key={key} className="nm-book">
                  <button
                    className={`nm-book-head ${series === sr.series && !book ? 'active' : ''}`}
                    onClick={() => { setOpenSeries((p) => ({ ...p, [key]: !p[key] })); choose(sub.code, sr.series); }}
                  >
                    {openSeries[key] ? '▾' : '▸'} {sr.series}<span className="nm-subject-count">{sr.count}</span>
                  </button>
                  {openSeries[key] && sr.books.map((b) => (
                    <button
                      key={b.book}
                      className={`nm-chapter-head ${book === b.book ? 'active' : ''}`}
                      onClick={() => choose(sub.code, sr.series, b.book)}
                    >
                      {b.book}<span className="nm-subject-count">{b.count}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </aside>
      <section className="nm-libmain">
        <div className="nm-filters">
          <input
            placeholder="搜索资源名称或路径"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <button className="nm-btn" onClick={loadRows} disabled={loading}>刷新</button>
          <span className="nm-total">
            {subjectCode ? `学科 ${subjectCode}` : '全部学科'}
            {series ? ` / ${series}` : ''}
            {book ? ` / ${book}` : ''} · 共 {total} 条
          </span>
        </div>

        {series && (
          <div className="nm-batchbar">
            <span>整体移动：{subjectCode} / {series}{book ? ` / ${book}` : ''}</span>
            <select value={targetSubject} onChange={(e) => setTargetSubject(e.target.value)}>
              <option value="">目标学科…</option>
              {tree.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <input className="nm-inline-input" placeholder="目标系列" value={targetSeries} onChange={(e) => setTargetSeries(e.target.value)} />
            <input className="nm-inline-input" placeholder="目标书目" value={targetBook} onChange={(e) => setTargetBook(e.target.value)} />
            <button className="nm-btn nm-btn-primary" onClick={moveCategory}>移动整个分类</button>
          </div>
        )}

        {picked.length > 0 && (
          <div className="nm-batchbar">
            <span>已选 {picked.length} 条</span>
            <select value={targetSubject} onChange={(e) => setTargetSubject(e.target.value)}>
              <option value="">目标学科…</option>
              {tree.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <input className="nm-inline-input" placeholder="目标系列" value={targetSeries} onChange={(e) => setTargetSeries(e.target.value)} />
            <input className="nm-inline-input" placeholder="目标书目" value={targetBook} onChange={(e) => setTargetBook(e.target.value)} />
            <button className="nm-btn nm-btn-primary" onClick={move}>移动到该分类</button>
            <button className="nm-btn" onClick={() => setPicked([])}>清空</button>
          </div>
        )}

        <table className="nm-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={rows.length > 0 && rows.every((r) => picked.includes(r.id))} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
              <th>资源</th><th>当前系列</th><th>当前书目</th><th>类型</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={picked.includes(r.id) ? 'selected' : ''}>
                <td><input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])} /></td>
                <td className="nm-name" title={r.path}>
                  <div>{r.name}</div>
                  {r.manualSeries || r.manualBook ? <div className="nm-subline">手动：{[r.manualSeries, r.manualBook].filter(Boolean).join(' / ')}</div> : null}
                </td>
                <td>{r.librarySeries || '未分类'}</td>
                <td>{r.libraryBook || '未分类'}</td>
                <td>{KIND_LABEL[r.assetKind] ?? r.assetKind}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && <tr><td colSpan={5} className="nm-empty">当前分类下没有资源</td></tr>}
          </tbody>
        </table>

        <div className="nm-pager">
          <button className="nm-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button className="nm-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      </section>
    </div>
  );
}

function actionLabel(a: BatchAction): string {
  const map: Record<BatchAction, string> = {
    confirm: '确认映射', move: '挂到小节', library: '归入教辅', pin: '设为精选', unpin: '取消精选',
    archive: '归档', restore: '恢复', ignore: '屏蔽', unmap: '解除映射',
  };
  return map[a];
}
