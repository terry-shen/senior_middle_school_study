import { useCallback, useEffect, useState } from 'react';
import {
  getStudentActivity,
  type ActivityEventType,
  type ActivityLogRow,
} from '../services/activity-log-api';

const TYPE_OPTIONS: Array<{ value: ActivityEventType | ''; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'page_view', label: '页面访问' },
  { value: 'nav_click', label: '导航点击' },
  { value: 'subject_open', label: '进入学科' },
  { value: 'chapter_open', label: '打开章节' },
  { value: 'asset_open', label: '打开资源' },
  { value: 'video_play', label: '视频播放' },
  { value: 'video_pause', label: '视频暂停' },
  { value: 'video_ended', label: '视频结束' },
  { value: 'video_seek', label: '视频拖动' },
  { value: 'search', label: '搜索' },
  { value: 'filter', label: '筛选' },
  { value: 'download', label: '下载' },
  { value: 'ui_click', label: '其他点击' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface Props {
  token: string;
  studentId: number;
}

/** Admin-only, 7-day activity trail for one student. */
export default function StudentActivityPanel({ token, studentId }: Props) {
  const [type, setType] = useState<ActivityEventType | ''>('');
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const res = await getStudentActivity(token, studentId, {
          days: 7,
          type,
          page: nextPage,
          limit: 50,
        });
        setRows((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(res.pagination.page);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      } catch (e) {
        setError(e instanceof Error ? e.message : '访问明细加载失败');
      } finally {
        setLoading(false);
      }
    },
    [token, studentId, type]
  );

  useEffect(() => {
    setRows([]);
    setPage(1);
    load(1, false);
  }, [load]);

  return (
    <div className="la-block la-activity">
      <div className="la-activity-head">
        <h3>访问明细</h3>
        <span className="la-activity-hint">仅保留最近 7 天</span>
      </div>

      <div className="la-activity-filters">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ActivityEventType | '')}
          aria-label="访问明细类型"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="la-activity-count">共 {total} 条</span>
      </div>

      {loading && rows.length === 0 && <p className="la-hint">加载中…</p>}
      {error && <p className="la-error-inline">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="la-hint">最近 7 天没有访问记录</p>}

      {rows.length > 0 && (
        <ul className="la-activity-list">
          {rows.map((row) => (
            <li key={row.id}>
              <span className={`la-ev la-ev-${row.type}`}>{TYPE_LABEL[row.type] ?? row.type}</span>
              <span className="la-activity-what" title={row.label || row.target || row.pagePath}>
                {row.label || row.target || row.pagePath}
              </span>
              <span className="la-activity-path" title={row.pagePath}>{row.pagePath}</span>
              <span className="la-ev-time">{fmtTime(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {page < totalPages && (
        <button className="la-activity-more" disabled={loading} onClick={() => load(page + 1, true)}>
          {loading ? '加载中…' : '加载更多'}
        </button>
      )}
    </div>
  );
}
