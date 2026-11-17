import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAnalyticsOverview,
  getAnalyticsStudent,
  type AnalyticsDetail,
  type AnalyticsOverviewRow,
} from '../services/learning-api';
import './LearningAnalytics.css';

const RANGES = [7, 30, 90];

function fmtDuration(sec: number): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec <= 0) return '0 秒';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分`;
  return `${Math.round(sec)} 秒`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '从未';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const EVENT_LABEL: Record<string, string> = {
  asset_open: '打开资源',
  asset_session: '学习资源',
  download: '下载资料',
  login: '登录',
};

export default function LearningAnalytics() {
  const { token } = useAuth();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<AnalyticsOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<AnalyticsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const r = await getAnalyticsOverview(token, days);
      setRows(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!token || !selected) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    getAnalyticsStudent(token, selected, days)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '详情加载失败'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [token, selected, days]);

  const maxDaily = Math.max(1, ...(detail?.daily.map((d) => d.sec + d.videoSec) ?? [1]));
  const maxHour = Math.max(1, ...(detail?.hours ?? [1]));
  const maxSection = Math.max(1, ...(detail?.topSections.map((s) => s.sec) ?? [1]));
  const totalSubject = Math.max(1, (detail?.subjectShare ?? []).reduce((n, s) => n + s.sec, 0));

  return (
    <div className="la-page">
      <div className="la-head">
        <h1>📊 学习分析</h1>
        <div className="la-ranges">
          {RANGES.map((d) => (
            <button key={d} className={`la-range ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              最近 {d} 天
            </button>
          ))}
          <button className="la-refresh" onClick={loadOverview}>刷新</button>
        </div>
      </div>
      <p className="la-sub">按「打开资源 → 关闭资源」的一次学习会话统计内容学习时长；视频以实际播放秒数计；只能下载的资料只记下载，不计时长。</p>

      {error && <div className="la-error">{error}</div>}

      <section className="la-card">
        <h2>学生概览</h2>
        {loading ? <p className="la-hint">加载中…</p> : rows.length === 0 ? (
          <p className="la-empty">暂无学生数据</p>
        ) : (
          <>
            <div className="la-table-wrap">
              <table className="la-table">
                <thead>
                  <tr>
                    <th className="la-col-name">学生</th>
                    <th>内容学习</th><th>视频观看</th><th>覆盖章节</th><th>回访</th>
                    <th>打开 / 下载</th><th>完成率</th><th>活跃 / 连续</th><th>最后活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const silent = r.contentSec === 0 && r.videoSec === 0;
                    return (
                      <tr
                        key={r.studentId}
                        className={`${selected === r.studentId ? 'selected' : ''} ${silent ? 'silent' : ''}`}
                        onClick={() => setSelected(r.studentId)}
                      >
                        <td className="la-col-name">
                          <span className="la-name">{r.name}</span>
                          <span className="la-meta">{r.studentNo} · {r.className ?? '未分班'}</span>
                          {silent && <span className="la-silent-tag">沉默</span>}
                        </td>
                        <td>{fmtDuration(r.contentSec)}</td>
                        <td>{fmtDuration(r.videoSec)}</td>
                        <td>{r.coveredSections}</td>
                        <td>{r.revisitAssets}</td>
                        <td>{r.opens} / {r.downloads}</td>
                        <td>{r.videoCompletion == null ? '—' : `${r.videoCompletion}%`}</td>
                        <td>{r.activeDays} / {r.streak}</td>
                        <td>{fmtDate(r.lastActiveAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="la-scards">
              {rows.map((r) => {
                const silent = r.contentSec === 0 && r.videoSec === 0;
                return (
                  <button
                    key={r.studentId}
                    type="button"
                    className={`la-scard ${selected === r.studentId ? 'selected' : ''} ${silent ? 'silent' : ''}`}
                    onClick={() => setSelected(r.studentId)}
                  >
                    <div className="la-scard-head">
                      <span className="la-name">{r.name}</span>
                      <span className="la-meta">{r.studentNo} · {r.className ?? '未分班'}</span>
                      {silent && <span className="la-silent-tag">沉默</span>}
                    </div>
                    <dl className="la-scard-grid">
                      <div><dt>内容学习</dt><dd>{fmtDuration(r.contentSec)}</dd></div>
                      <div><dt>视频观看</dt><dd>{fmtDuration(r.videoSec)}</dd></div>
                      <div><dt>覆盖章节</dt><dd>{r.coveredSections}</dd></div>
                      <div><dt>回访资源</dt><dd>{r.revisitAssets}</dd></div>
                      <div><dt>打开 / 下载</dt><dd>{r.opens} / {r.downloads}</dd></div>
                      <div><dt>完成率</dt><dd>{r.videoCompletion == null ? '—' : `${r.videoCompletion}%`}</dd></div>
                      <div><dt>活跃 / 连续</dt><dd>{r.activeDays} / {r.streak}</dd></div>
                      <div><dt>最后活跃</dt><dd>{fmtDate(r.lastActiveAt)}</dd></div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {selected && (
        <section className="la-card">
          <h2>学生详情 {detail ? `· ${detail.student.name}` : ''}</h2>
          {detailLoading && <p className="la-hint">加载中…</p>}
          {detail && (
            <>
              <div className="la-kpis">
                <div className="la-kpi"><b>{fmtDuration(detail.totals.contentSec)}</b><span>内容学习时长</span></div>
                <div className="la-kpi"><b>{fmtDuration(detail.totals.videoSec)}</b><span>视频观看时长</span></div>
                <div className="la-kpi"><b>{detail.totals.videoCompletion == null ? '—' : `${detail.totals.videoCompletion}%`}</b><span>视频完成率</span></div>
                <div className="la-kpi"><b>{detail.totals.coveredSections}</b><span>覆盖章节</span></div>
                <div className="la-kpi"><b>{detail.totals.revisitAssets}</b><span>回访资源</span></div>
                <div className="la-kpi"><b>{detail.totals.opens}</b><span>打开资源</span></div>
                <div className="la-kpi"><b>{detail.totals.downloads}</b><span>下载资料</span></div>
              </div>

              <div className="la-grid">
                <div className="la-block">
                  <h3>每日学习时长</h3>
                  {detail.daily.length === 0 ? <p className="la-hint">区间内没有学习记录</p> : (
                    <div className="la-bars">
                      {detail.daily.map((d) => {
                        const h = Math.round(((d.sec + d.videoSec) / maxDaily) * 100);
                        return (
                          <div key={d.date} className="la-bar-col" title={`${d.date}：${fmtDuration(d.sec + d.videoSec)}`}>
                            <div className="la-bar" style={{ height: `${Math.max(2, h)}%` }} />
                            <span className="la-bar-label">{d.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="la-block">
                  <h3>活跃时段（0–23 时）</h3>
                  <div className="la-heat">
                    {detail.hours.map((v, i) => (
                      <div
                        key={i}
                        className="la-heat-cell"
                        title={`${i}:00 — ${fmtDuration(v)}`}
                        style={{ background: `rgba(37,99,235,${v ? 0.15 + (v / maxHour) * 0.85 : 0.06})` }}
                      >
                        <span>{i}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="la-block">
                  <h3>章节投入 Top</h3>
                  {detail.topSections.length === 0 ? <p className="la-hint">暂无章节数据</p> : (
                    <ul className="la-rank">
                      {detail.topSections.map((s) => (
                        <li key={s.sectionId}>
                          <div className="la-rank-head">
                            <span className="la-rank-title" title={`${s.textbookName ?? ''} / ${s.chapterTitle ?? ''} / ${s.title}`}>{s.title}</span>
                            <span className="la-rank-val">{fmtDuration(s.sec)}</span>
                          </div>
                          <div className="la-rank-bar"><i style={{ width: `${Math.round((s.sec / maxSection) * 100)}%` }} /></div>
                          <span className="la-rank-meta">{s.subjectName ?? ''} · {s.chapterTitle ?? ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="la-block">
                  <h3>资源学习 Top</h3>
                  {detail.topAssets.length === 0 ? <p className="la-hint">暂无资源学习数据</p> : (
                    <ul className="la-rank">
                      {detail.topAssets.map((a, i) => {
                        const maxAsset = Math.max(1, ...detail.topAssets.map((x) => x.dwellSec));
                        return (
                          <li key={`${a.assetId ?? 'n'}-${i}`}>
                            <div className="la-rank-head">
                              <span className="la-rank-title" title={`${a.subjectName ?? ''} / ${a.chapterTitle ?? ''} / ${a.sectionTitle ?? ''} / ${a.name}`}>{a.name}</span>
                              <span className="la-rank-val">{fmtDuration(a.dwellSec)}</span>
                            </div>
                            <div className="la-rank-bar"><i style={{ width: `${Math.round((a.dwellSec / maxAsset) * 100)}%` }} /></div>
                            <span className="la-rank-meta">
                              {[a.subjectName, a.chapterTitle, a.sectionTitle].filter(Boolean).join(' · ') || '未关联章节'}
                              {a.playSec > 0 ? ` · 播放 ${fmtDuration(a.playSec)}` : ''}
                              {a.opens > 1 ? ` · 打开 ${a.opens} 次` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="la-block">
                  <h3>视频进度分布</h3>
                  {detail.progress.rows.length === 0 ? <p className="la-hint">区间内没有视频观看记录</p> : (
                    <>
                      <div className="la-buckets">
                        {detail.progress.buckets.map((b) => {
                          const maxBucket = Math.max(1, ...detail.progress.buckets.map((x) => x.count));
                          return (
                            <div key={b.range} className="la-bucket" title={`${b.range}：${b.count} 个视频`}>
                              <div className="la-bucket-bar" style={{ height: `${Math.max(3, Math.round((b.count / maxBucket) * 100))}%` }} />
                              <span className="la-bucket-label">{b.range.replace('100%', '100%')}</span>
                              <span className="la-bucket-count">{b.count}</span>
                            </div>
                          );
                        })}
                      </div>
                      <ul className="la-rank la-progress-list">
                        {detail.progress.rows.slice(0, 8).map((p) => (
                          <li key={`${p.assetId}-${p.lastAt}`}>
                            <div className="la-rank-head">
                              <span className="la-rank-title" title={p.name}>{p.name}</span>
                              <span className="la-rank-val">{p.percent}%</span>
                            </div>
                            <div className="la-rank-bar"><i style={{ width: `${Math.min(100, p.percent)}%` }} /></div>
                            <span className="la-rank-meta">播放 {fmtDuration(p.playSec)} / 总长 {fmtDuration(p.duration)}</span>
                          </li>
                        ))}
                      </ul>
            </>
                  )}
                </div>

                <div className="la-block">
                  <h3>章节覆盖（{detail.coverage.coveredSections} / {detail.coverage.totalSections}）</h3>
                  {detail.coverage.bySubject.length === 0 ? <p className="la-hint">暂无覆盖数据</p> : (
                    <ul className="la-share">
                      {detail.coverage.bySubject.map((s) => (
                        <li key={s.subjectName}>
                          <span className="la-share-name">{s.subjectName}</span>
                          <div className="la-share-bar"><i style={{ width: `${Math.min(100, s.percent)}%` }} /></div>
                          <span className="la-share-val">{s.covered}/{s.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              <div className="la-block la-recent">
                <h3>资料下载明细</h3>
                {detail.downloads.length === 0 ? <p className="la-hint">区间内没有下载记录</p> : (
                  <ul className="la-events">
                    {detail.downloads.map((d) => (
                      <li key={d.id}>
                        <span className="la-ev la-ev-download">下载</span>
                        <span className="la-ev-what">
                          {d.assetName
                            ? d.assetName
                            : typeof d.meta?.name === 'string'
                              ? (d.meta.name as string)
                              : d.sectionTitle ?? '—'}
                        </span>
                        {(d.subjectName || d.chapterTitle || d.sectionTitle) && (
                          <span className="la-ev-sec">
                            {[d.subjectName, d.chapterTitle, d.sectionTitle].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        <span className="la-ev-time">{fmtDate(d.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

                <div className="la-block">
                  <h3>学科投入占比</h3>
                  {detail.subjectShare.length === 0 ? <p className="la-hint">暂无学科数据</p> : (
                    <ul className="la-share">
                      {detail.subjectShare.map((s) => (
                        <li key={s.name}>
                          <span className="la-share-name">{s.name}</span>
                          <div className="la-share-bar"><i style={{ width: `${Math.round((s.sec / totalSubject) * 100)}%` }} /></div>
                          <span className="la-share-val">{Math.round((s.sec / totalSubject) * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="la-block la-recent">
                <h3>最近行为</h3>
                {detail.recent.length === 0 ? <p className="la-hint">暂无行为记录</p> : (
                  <ul className="la-events">
                    {detail.recent.map((e) => (
                      <li key={e.id}>
                        <span className={`la-ev la-ev-${e.type}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                        <span className="la-ev-what">
                          {e.assetName
                            ? e.assetName
                            : typeof e.meta?.name === 'string'
                              ? (e.meta.name as string)
                              : e.sectionTitle ?? '—'}
                        </span>
                        {(e.subjectName || e.chapterTitle || e.sectionTitle) && (
                          <span className="la-ev-sec">
                            {[e.subjectName, e.chapterTitle, e.sectionTitle].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        {e.durationSec > 0 && <span className="la-ev-dur">{fmtDuration(e.durationSec)}</span>}
                        <span className="la-ev-time">{fmtDate(e.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
