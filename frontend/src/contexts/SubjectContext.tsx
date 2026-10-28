/**
 * SubjectContext — 全局学科切换 Context
 *
 * - 学科列表从公开端点 GET /api/subjects 加载
 * - 选中学科持久化到 localStorage（记住上次选择），首次默认数学（code=math）
 * - 选中值同步写入 subjects-api 模块级状态，供各 API 服务隐式附加 subjectId
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getSubjects, setSelectedSubjectId } from '../services/subjects-api';
import type { Subject } from '../services/subjects-api';

interface SubjectContextValue {
  subjects: Subject[];
  selectedId: number | null;
  selectedSubject: Subject | null;
  select: (id: number | null) => void;
  loading: boolean;
}

const SubjectContext = createContext<SubjectContextValue>({
  subjects: [],
  selectedId: null,
  selectedSubject: null,
  select: () => {},
  loading: true,
});

export function SubjectProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getSubjects();
        if (cancelled) return;
        setSubjects(list);
        // 恢复上次选择；无效（不存在/停用）时兜底数学
        let stored: number | null = null;
        try {
          const raw = localStorage.getItem('selectedSubjectId');
          if (raw) stored = parseInt(raw, 10) || null;
        } catch { /* ignore */ }
        const valid = stored != null && list.some((s) => s.id === stored && s.isActive)
          ? stored
          : list.find((s) => s.code === 'math' && s.isActive)?.id ?? list.find((s) => s.isActive)?.id ?? null;
        setSelectedId(valid);
        setSelectedSubjectId(valid);
      } catch (e) {
        console.error('加载学科列表失败', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const select = (id: number | null) => {
    setSelectedId(id);
    setSelectedSubjectId(id);
  };

  const selectedSubject = subjects.find((s) => s.id === selectedId) ?? null;

  return (
    <SubjectContext.Provider value={{ subjects, selectedId, selectedSubject, select, loading }}>
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubject() {
  return useContext(SubjectContext);
}
