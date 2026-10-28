/**
 * SubjectSwitcher — 全局学科切换器
 *
 * 放置于侧边栏品牌区下方（sidebar-navigation 后已无独立顶栏）。
 * - 管理员可选「全部」（不加 subjectId，后端返回全部数据）
 * - 学生端不显示「全部」，只能在学科间切换
 * - 切换后整页刷新，使所有页面数据按新学科重新加载
 */
import { useSubject } from '../contexts/SubjectContext';
import { useAuth } from '../contexts/AuthContext';
import './SubjectSwitcher.css';

export default function SubjectSwitcher() {
  const { subjects, selectedId, select, loading } = useSubject();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleChange = (value: string) => {
    const id = value === 'all' ? null : parseInt(value, 10);
    if (id === selectedId) return;
    select(id);
    // 切换学科后刷新页面数据（用户预期：切换即刷新）
    window.location.reload();
  };

  return (
    <div className="subject-switcher">
      <label className="subject-switcher-label" htmlFor="subject-switcher-select">学科</label>
      <select
        id="subject-switcher-select"
        className="subject-switcher-select"
        value={selectedId == null ? 'all' : String(selectedId)}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
      >
        {isAdmin && <option value="all">全部</option>}
        {subjects.filter((s) => s.isActive).map((s) => (
          <option key={s.id} value={s.id}>
            {s.icon ? `${s.icon} ` : ''}{s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
