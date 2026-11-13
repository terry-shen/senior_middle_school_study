import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTaxonomyTree } from '../services/chapters-api';
import type { TextbookNode } from '../services/chapters-api';
import {
  batchAction, getIndexStats, getScanStatus, listAssets, pauseScan, remapAssets, startScan,
} from '../services/netdisk-index-api';
import type { AssetRow, IndexStats, ScanStatus } from '../services/netdisk-index-api';
import type { BatchAction } from '../services/netdisk-index-api';
import './NetdiskMapping.css';

const KIND_LABEL: Record<string, string> = {
  lecture: '讲义', ppt: '课件', answer: '答案解析', practice: '练习', exam: '试卷',
  plan: '复习资料', audio: '音频', video: '视频', image: '图片', junk: '垃圾', other: '其他',
};
const AUD_LABEL: Record<string, string> = { student: '学生', teacher: '教师', both: '通用' };

export default function NetdiskMapping() {
  const { token } = useAuth();

  const [tree, setTree] = useState<TextbookNode[]>([]);
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [unmapped, setUnmapped] = useState(true);
  const [q, setQ] = useState('');
  const [assetKind, setAssetKind] = useState('');
  const [audience, setAudience] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openBooks, setOpenBooks] = useState<number[]>([]);
  const [openChapters, setOpenChapters] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [remapping, setRemapping] = useState(false);

  const sectionCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of stats?.bySection ?? []) map.set(s.sectionId, s.count);
    return map;
  }, [stats]);

  const treeGroups = useMemo(() => {
    const map = new Map<number, { id: number; name: string; icon: string | null; books: TextbookNode[] }>();
    for (const b of tree) {
      const g = map.get(b.subjectId) ?? {
        id: b.subjectId,
        name: b.subjectName,
        icon: b.subjectIcon ?? null,
        books: [],
      };
      g.books.push(b);
      map.set(g.id, g);
    }
    return [...map.values()];
  }, [tree]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try { setStats(await getIndexStats(token)); } catch { /* 忽略 */ }
  }, [token]);

  const loadTree = useCallback(async () => {
    if (!token) return;
    try {
      const books = await getTaxonomyTree(token);
      setTree(books);
      if (books[0]) setOpenBooks([books[0].id]);
    } catch (e) { setMessage((e as Error).message); }
  }, [token]);

  const loadAssets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await listAssets(token, {
        sectionId: unmapped ? undefined : selectedSectionId ?? undefined,
        unmapped,
        assetKind: assetKind || undefined,
        audience: audience || undefined,
        q: q.trim() || undefined,
        page,
        limit: 50,
      });
      setAssets(r.data ?? []);
      setTotal(r.pagination?.total ?? 0);
      setTotalPages(r.pagination?.totalPages ?? 1);
      setSelectedIds([]);
    } catch (e) { setMessage((e as Error).message); }
    setLoading(false);
  }, [token, unmapped, selectedSectionId, assetKind, audience, q, page]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  // 扫描状态轮询
  useEffect(() => {
    if (!token) return;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const r = await getScanStatus(token);
        setScan(r.status);
        if (r.status.status === 'running') timer = window.setTimeout(tick, 3000);
      } catch { /* 忽略 */ }
    };
    tick();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [token]);

  const refreshAll = async () => { await Promise.all([loadStats(), loadAssets()]); };

  const handleScan = async (restart: boolean) => {
    if (!token) return;
    try {
      const r = await startScan(token, restart);
      setScan(r.status);
      setMessage(restart ? '已重启扫描（将从头遍历网盘）' : '扫描已启动');
    } catch (e) { setMessage((e as Error).message); }
  };

  const handlePause = async () => {
    if (!token) return;
    try { const r = await pauseScan(token); setScan(r.status); setMessage('扫描已暂停'); }
    catch (e) { setMessage((e as Error).message); }
  };

  const handleRemap = async () => {
    if (!token) return;
    setRemapping(true);
    try {
      const r = await remapAssets(token);
      setMessage(`重新映射完成：扫描 ${r.scanned} 条，自动确认 ${r.mapped} 条，覆盖 ${r.perSection} 个章节`);
      await refreshAll();
    } catch (e) { setMessage((e as Error).message); }
    setRemapping(false);
  };

  const toggleBook = (id: number) => setOpenBooks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleChapter = (id: number) => setOpenChapters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectSection = (id: number) => {
    setSelectedSectionId(id);
    setUnmapped(false);
    setPage(1);
  };

  const toggleAsset = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const pageIds = assets.map(a => a.id);
  const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const toggleAll = () => setSelectedIds(allChecked ? [] : pageIds);

  const doBatch = async (action: BatchAction, sectionId?: number | null) => {
    if (!token || selectedIds.length === 0) { setMessage('请先勾选资源'); return; }
    try {
      const r = await batchAction(token, selectedIds, action, sectionId ?? selectedSectionId);
      setMessage(`操作成功，影响 ${r.affected} 条`);
      await refreshAll();
    } catch (e) { setMessage((e as Error).message); }
  };

  const scanLabel = scan ? {
    idle: '未扫描', running: '扫描中', paused: '已暂停', done: '已完成', error: '出错',
  }[scan.status] : '加载中';

  return (
    <div className="netdisk-mapping">
      <div className="nm-head">
        <div>
          <h1>🗃️ 资源映射工作台</h1>
          <p className="nm-sub">全部学科 ｜ 网盘索引 → 章节映射 → 精选收敛</p>
        </div>
        <div className="nm-scan">
          <span className={`nm-chip nm-chip-${scan?.status ?? 'idle'}`}>{scanLabel}</span>
          <button className="nm-btn nm-btn-primary" onClick={() => handleScan(false)} disabled={scan?.status === 'running'}>
            {scan?.status === 'paused' ? '继续扫描' : '开始扫描'}
          </button>
          <button className="nm-btn" onClick={() => handleScan(true)}>重新扫描</button>
          <button className="nm-btn" onClick={handlePause} disabled={scan?.status !== 'running'}>暂停</button>
          <button className="nm-btn" onClick={handleRemap} disabled={remapping}>{remapping ? '映射中…' : '重新自动映射'}</button>
        </div>
      </div>

      {scan && (
        <div className="nm-scan-line">
          已扫描目录 {scan.scannedDirs} ｜ 索引文件 {scan.totalFiles} ｜ 待扫目录 {scan.queueLength}
          {scan.currentDir ? ` ｜ 当前 ${scan.currentDir}` : ''}
          {scan.lastError ? ` ｜ 最近错误 ${scan.lastError}` : ''}
        </div>
      )}

      <div className="nm-stats">
        <div className="nm-stat"><span>{stats?.total ?? '--'}</span>索引总数</div>
        <div className="nm-stat"><span>{stats?.mapped ?? '--'}</span>已挂章节</div>
        <div className="nm-stat"><span>{stats?.unmapped ?? '--'}</span>未映射</div>
        <div className="nm-stat"><span>{stats?.pinned ?? '--'}</span>已精选</div>
        {(stats?.byKind ?? []).slice(0, 8).map(k => (
          <div key={k.key} className="nm-tag">{KIND_LABEL[k.key] ?? k.key} {k.count}</div>
        ))}
      </div>

      {message && <div className="nm-message" onClick={() => setMessage('')}>{message}</div>}

      <div className="nm-layout">
        <aside className="nm-tree">
          <div className="nm-pane-head">章节树</div>
          <button className={`nm-tree-item ${unmapped ? 'active' : ''}`} onClick={() => { setUnmapped(true); setPage(1); }}>
            仅未映射（{stats?.unmapped ?? 0}）
          </button>
          {treeGroups.map(g => (
            <div key={g.id} className="nm-subject">
              <div className="nm-subject-head">
                {g.icon} {g.name}
                <span className="nm-subject-count">{g.books.length} 册</span>
              </div>
              {g.books.map(book => (
                <div key={book.id} className="nm-book">
                  <button className="nm-book-head" onClick={() => toggleBook(book.id)}>
                    {openBooks.includes(book.id) ? '▾' : '▸'} {book.name}
                  </button>
                  {openBooks.includes(book.id) && book.chapters.map(ch => (
                    <div key={ch.id} className="nm-chapter">
                      <button className="nm-chapter-head" onClick={() => toggleChapter(ch.id)}>
                        {openChapters.includes(ch.id) ? '▾' : '▸'} {ch.order}. {ch.title}
                      </button>
                      {openChapters.includes(ch.id) && ch.sections.map(sec => (
                        <button
                          key={sec.id}
                          className={`nm-section ${!unmapped && selectedSectionId === sec.id ? 'active' : ''}`}
                          onClick={() => selectSection(sec.id)}
                        >
                          {sec.order}. {sec.title}
                          <span className="nm-count">{sectionCounts.get(sec.id) ?? 0}</span>
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
            <select value={assetKind} onChange={e => { setAssetKind(e.target.value); setPage(1); }}>
              <option value="">全部类型</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={audience} onChange={e => { setAudience(e.target.value); setPage(1); }}>
              <option value="">全部对象</option>
              <option value="student">学生</option>
              <option value="teacher">教师</option>
              <option value="both">通用</option>
            </select>
            <button className="nm-btn" onClick={refreshAll}>刷新</button>
            <span className="nm-total">共 {total} 条</span>
          </div>

          <table className="nm-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th>文件名</th>
                <th>类型</th>
                <th>对象</th>
                <th>年份</th>
                <th>地区</th>
                <th>系列</th>
                <th>章节</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className={selectedIds.includes(a.id) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleAsset(a.id)} /></td>
                  <td className="nm-name" title={a.path}>{a.name}{a.isPinned && <span className="nm-pin">精选</span>}</td>
                  <td>{KIND_LABEL[a.assetKind] ?? a.assetKind}</td>
                  <td>{AUD_LABEL[a.audience] ?? a.audience}</td>
                  <td>{a.year ?? '-'}</td>
                  <td>{a.region ?? '-'}</td>
                  <td>{a.series ?? '-'}</td>
                  <td className="nm-sec">{a.section ? `${a.section.title}` : '未映射'}{a.mapConfirmed ? ' ✓' : ''}</td>
                  <td>{a.status === 'active' ? '正常' : a.status === 'archive' ? '已归档' : '已屏蔽'}</td>
                </tr>
              ))}
              {assets.length === 0 && !loading && <tr><td colSpan={9} className="nm-empty">没有匹配的资源</td></tr>}
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
          <div className="nm-selected">已选 {selectedIds.length} 条</div>
          <div className="nm-target">
            目标小节：{selectedSectionId ?? '未选择'}
          </div>
          <button className="nm-btn nm-btn-primary" onClick={() => doBatch('move')}>挂到选中节</button>
          <button className="nm-btn" onClick={() => doBatch('confirm')}>确认映射</button>
          <button className="nm-btn" onClick={() => doBatch('pin')}>设为精选（每节≤5）</button>
          <button className="nm-btn" onClick={() => doBatch('unpin')}>取消精选</button>
          <button className="nm-btn" onClick={() => doBatch('archive')}>归档</button>
          <button className="nm-btn" onClick={() => doBatch('ignore')}>屏蔽</button>
          <button className="nm-btn" onClick={() => doBatch('restore')}>恢复</button>
          <button className="nm-btn nm-btn-danger" onClick={() => doBatch('unmap')}>解除映射</button>
          <p className="nm-hint">自动映射结果为候选，需人工确认后才会出现在学生端。</p>
        </aside>
      </div>
    </div>
  );
}
