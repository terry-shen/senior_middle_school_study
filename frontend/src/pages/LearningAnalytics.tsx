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
  if (!sec) return '—';
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
  heartbeat: '学习心跳',
  asset_open: '打开资源',
  asset_dwell: '资源停留',
  video_progress: '观看视频',
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
      <p className="la-sub">基于心跳与视频播放上报统计有效学习时长；数据由客户端上报，仅供教学参考。</p>

      {error && <div className="la-error">{error}</div>}

      <section className="la-card">
        <h2>学生概览</h2>
        {loading ? <p className="la-hint">加载中…</p> : (
          <table className="la-table">
            <thead>
              <tr>
                <th>学生</th><th>班级</th><th>有效时长</th><th>视频时长</th><th>活跃天数</th>
                <th>连续天数</th><th>打开</th><th>下载</th><th>视频完成率</th><th>最后活跃</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const silent = r.studySec === 0 && r.videoSec === 0;
                return (
                  <tr
                    key={r.studentId}
                    className={`${selected === r.studentId ? 'selected' : ''} ${silent ? 'silent' : ''}`}
                    onClick={() => setSelected(r.studentId)}
                  >
                    <td>{r.name} <span className="la-no">{r.studentNo}</span>{silent && <span className="la-silent-tag">沉默</span>}</td>
                    <td>{r.className ?? '—'}</td>
                    <td>{fmtDuration(r.studySec)}</td>
                    <td>{fmtDuration(r.videoSec)}</td>
                    <td>{r.activeDays}</td>
                    <td>{r.streak}</td>
                    <td>{r.opens}</td>
                    <td>{r.downloads}</td>
                    <td>{r.videoCompletion == null ? '—' : `${r.videoCompletion}%`}</td>
                    <td>{fmtDate(r.lastActiveAt)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={10} className="la-empty">暂无学生数据</td></tr>}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <section className="la-card">
          <h2>学生详情 {detail ? `· ${detail.student.name}` : ''}</h2>
          {detailLoading && <p className="la-hint">加载中…</p>}
          {detail && (
            <>
              <div className="la-kpis">
                <div className="la-kpi"><b>{fmtDuration(detail.totals.studySec)}</b><span>有效学习时长</span></div>
                <div className="la-kpi"><b>{fmtDuration(detail.totals.videoSec)}</b><span>视频观看时长</span></div>
                <div className="la-kpi"><b>{fmtDuration(detail.totals.dwellSec)}</b><span>资源停留时长</span></div>
                <div className="la-kpi"><b>{detail.totals.opens}</b><span>打开资源</span></div>
                <div className="la-kpi"><b>{detail.totals.downloads}</b><span>下载资料</span></div>
                <div className="la-kpi"><b>{detail.totals.events}</b><span>事件总数</span></div>
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
                  <h3>资源停留 Top</h3>
                  {detail.topAssets.length === 0 ? <p className="la-hint">暂无资源停留数据</p> : (
                    <ul className="la-rank">
                      {detail.topAssets.map((a, i) => {
                        const maxAsset = Math.max(1, ...detail.topAssets.map((x) => x.sec));
                        return (
                          <li key={`${a.assetId ?? 'n'}-${i}`}>
                            <div className="la-rank-head">
                              <span className="la-rank-title" title={`${a.subjectName ?? ''} / ${a.chapterTitle ?? ''} / ${a.sectionTitle ?? ''} / ${a.name}`}>{a.name}</span>
                              <span className="la-rank-val">{fmtDuration(a.sec)}</span>
                            </div>
                            <div className="la-rank-bar"><i style={{ width: `${Math.round((a.sec / maxAsset) * 100)}%` }} /></div>
                            <span className="la-rank-meta">
                              {[a.subjectName, a.chapterTitle, a.sectionTitle].filter(Boolean).join(' · ') || '未关联章节'}
                              {a.videoSec > 0 ? ` · 观看 ${fmtDuration(a.videoSec)}` : ''}
                              {a.opens > 1 ? ` · 打开 ${a.opens} 次` : ''}
                            </span>
                          </li>
                        );
                      })}
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
