/**
 * SubjectSelect — 可复用学科选择下拉
 *
 * - 选项来源 SubjectContext（已在 App 顶层加载，无需重复请求）
 * - 默认值：value 为空时自动使用当前全局切换器学科（defaultToCurrent）
 * - activeOnly：只显示启用学科（表单场景）；管理页面用 includeInactive
 */
import { useSubject } from '../contexts/SubjectContext';
import type { Subject } from '../services/subjects-api';

interface SubjectSelectProps {
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  /** value 为空时是否自动回落到当前切换器学科（默认 true） */
  defaultToCurrent?: boolean;
  /** 是否允许"不指定"选项（默认 false） */
  allowEmpty?: boolean;
  /** 空选项文案 */
  emptyLabel?: string;
  /** 是否包含停用学科（管理页面用） */
  includeInactive?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function SubjectSelect({
  value,
  onChange,
  defaultToCurrent = true,
  allowEmpty = false,
  emptyLabel = '不指定学科',
  includeInactive = false,
  disabled = false,
  style,
}: SubjectSelectProps) {
  const { subjects, selectedId, loading } = useSubject();
  const list = includeInactive ? subjects : subjects.filter((s) => s.isActive);

  // 表单受控值为空且允许默认时，显示当前切换器学科（不自动写回父组件，提交时由父组件用 effectiveValue）
  const effective: number | null = value != null
    ? value
    : defaultToCurrent
      ? selectedId
      : null;

  const handleChange = (raw: string) => {
    if (raw === '') { onChange(null); return; }
    onChange(parseInt(raw, 10));
  };

  if (loading && list.length === 0) {
    return <select disabled style={style}><option>加载学科…</option></select>;
  }

  return (
    <select value={effective == null ? '' : String(effective)} onChange={e => handleChange(e.target.value)} disabled={disabled} style={style}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {list.map((s: Subject) => (
        <option key={s.id} value={s.id}>
          {s.icon ? `${s.icon} ` : ''}{s.name}
        </option>
      ))}
    </select>
  );
}

/** 计算表单最终提交用的 subjectId（受控值优先，否则当前切换器学科） */
export function resolveSubjectId(value: number | null | undefined, fallback: number | null): number | null {
  if (value != null) return value;
  return fallback ?? null;
}
