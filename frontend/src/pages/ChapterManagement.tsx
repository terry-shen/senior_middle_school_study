import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubject } from '../contexts/SubjectContext';
import type { TextbookNode } from '../services/chapters-api';
import {
  getTaxonomyTree,
  createTextbook,
  updateTextbook,
  deleteTextbook,
  createChapter,
  updateChapter,
  deleteChapter,
  createSection,
  updateSection,
  deleteSection,
  getSectionReferences,
} from '../services/chapters-api';
import './ChapterManagement.css';

export default function ChapterManagement() {
  const { token, user } = useAuth();
  const { selectedId, selectedSubject } = useSubject();
  const [books, setBooks] = useState<TextbookNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openBooks, setOpenBooks] = useState<Record<number, boolean>>({});
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTaxonomyTree(token, selectedId || undefined);
      setBooks(data);
      // 默认展开第一册
      if (data.length > 0) {
        setOpenBooks((prev) => (Object.keys(prev).length ? prev : { [data[0].id]: true }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const addBook = () => {
    if (!token || !selectedId) return;
    const name = prompt('教材名称（例如：必修第一册）');
    if (!name) return;
    const edition = prompt('教材版本（留空默认 人教A）', '人教A') || '人教A';
    const grade = prompt('年级（可留空，例如：高一上）') || null;
    guard(() => createTextbook(token, { subjectId: selectedId, name, edition, grade }));
  };

  const renameBook = (b: TextbookNode) => {
    if (!token) return;
    const name = prompt('教材名称', b.name);
    if (!name) return;
    guard(() => updateTextbook(token, b.id, { name }));
  };

  const removeBook = (b: TextbookNode) => {
    if (!token) return;
    if (!confirm(`删除教材「${b.name}」？（需先删除其下章节）`)) return;
    guard(() => deleteTextbook(token, b.id));
  };

  const addChapter = (b: TextbookNode) => {
    if (!token) return;
    const title = prompt('章节标题（例如：第一章 集合与常用逻辑用语）');
    if (!title) return;
    guard(() => createChapter(token, { textbookId: b.id, title }));
  };

  const renameChapter = (id: number, title: string) => {
    if (!token) return;
    const next = prompt('章节标题', title);
    if (!next) return;
    guard(() => updateChapter(token, id, { title: next }));
  };

  const removeChapter = (id: number, title: string) => {
    if (!token) return;
    if (!confirm(`删除章节「${title}」？（需先删除其下小节）`)) return;
    guard(() => deleteChapter(token, id));
  };

  const addSection = (chapterId: number) => {
    if (!token) return;
    const title = prompt('小节标题（例如：1.1 集合的概念）');
    if (!title) return;
    guard(() => createSection(token, { chapterId, title }));
  };

  const renameSection = (id: number, title: string) => {
    if (!token) return;
    const next = prompt('小节标题', title);
    if (!next) return;
    guard(() => updateSection(token, id, { title: next }));
  };

  const removeSection = async (id: number, title: string) => {
    if (!token) return;
    try {
      const refs = await getSectionReferences(token, id);
      const total = refs?.total ?? 0;
      if (total > 0) {
        alert(`该小节已被引用（资源 ${refs.resources} / 试卷 ${refs.papers} / 错题 ${refs.wrongQuestions}），请先解除关联`);
        return;
      }
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    if (!confirm(`删除小节「${title}」？`)) return;
    guard(() => deleteSection(token, id));
  };

  const totalChapters = books.reduce((a, b) => a + b.chapters.length, 0);
  const totalSections = books.reduce((a, b) => a + b.chapters.reduce((x, c) => x + c.sections.length, 0), 0);

  return (
    <div className="chapter-mgmt">
      <div className="cm-head">
        <div>
          <h1>🗂️ 章节管理</h1>
          <p className="cm-sub">
            当前学科：{selectedSubject?.icon} {selectedSubject?.name} ｜ 教材 {books.length} 册 · 章 {totalChapters} · 节{' '}
            {totalSections}
          </p>
        </div>
        {isAdmin && (
          <div className="cm-actions">
            <button className="cm-btn cm-btn-primary" onClick={addBook}>
              + 新增教材
            </button>
            <button className="cm-btn" onClick={load} disabled={loading}>
              刷新
            </button>
          </div>
        )}
      </div>

      {error && <div className="cm-error">{error}</div>}
      {loading && books.length === 0 && <div className="cm-loading">加载中...</div>}
      {!loading && books.length === 0 && <div className="cm-empty">该学科暂无教材，点击「新增教材」开始建立章节轴</div>}

      <div className="cm-tree">
        {books.map((b) => {
          const bookOpen = openBooks[b.id] ?? false;
          return (
            <div key={b.id} className="cm-book">
              <div className="cm-row cm-row-book">
                <button
                  className="cm-toggle"
                  onClick={() => setOpenBooks((p) => ({ ...p, [b.id]: !bookOpen }))}
                  aria-label="展开/折叠"
                >
                  {bookOpen ? '▾' : '▸'}
                </button>
                <span className="cm-title">
                  📘 {b.name}
                  <span className="cm-tag">{b.edition}</span>
                  {b.grade && <span className="cm-tag cm-tag-light">{b.grade}</span>}
                </span>
                <span className="cm-count">
                  {b.chapters.length} 章 / {b.chapters.reduce((x, c) => x + c.sections.length, 0)} 节
                </span>
                {isAdmin && (
                  <span className="cm-btns">
                    <button className="cm-btn cm-btn-sm" onClick={() => addChapter(b)}>
                      + 章
                    </button>
                    <button className="cm-btn cm-btn-sm" onClick={() => renameBook(b)}>
                      重命名
                    </button>
                    <button className="cm-btn cm-btn-sm cm-btn-danger" onClick={() => removeBook(b)}>
                      删除
                    </button>
                  </span>
                )}
              </div>

              {bookOpen &&
                b.chapters.map((c) => {
                  const chapterOpen = openChapters[c.id] ?? false;
                  return (
                    <div key={c.id} className="cm-chapter">
                      <div className="cm-row cm-row-chapter">
                        <button
                          className="cm-toggle"
                          onClick={() => setOpenChapters((p) => ({ ...p, [c.id]: !chapterOpen }))}
                          aria-label="展开/折叠"
                        >
                          {chapterOpen ? '▾' : '▸'}
                        </button>
                        <span className="cm-title">
                          📑 {c.order}. {c.title}
                        </span>
                        <span className="cm-count">{c.sections.length} 节</span>
                        {isAdmin && (
                          <span className="cm-btns">
                            <button className="cm-btn cm-btn-sm" onClick={() => addSection(c.id)}>
                              + 节
                            </button>
                            <button className="cm-btn cm-btn-sm" onClick={() => renameChapter(c.id, c.title)}>
                              重命名
                            </button>
                            <button
                              className="cm-btn cm-btn-sm cm-btn-danger"
                              onClick={() => removeChapter(c.id, c.title)}
                            >
                              删除
                            </button>
                          </span>
                        )}
                      </div>

                      {chapterOpen && (
                        <div className="cm-sections">
                          {c.sections.map((s) => (
                            <div key={s.id} className="cm-row cm-row-section">
                              <span className="cm-dot">•</span>
                              <span className="cm-title cm-title-section">{s.title}</span>
                              <span className="cm-badges">
                                <span className="cm-badge">资源 {s.resourceCount}</span>
                                <span className="cm-badge">试卷 {s.paperCount}</span>
                                <span className="cm-badge">错题 {s.wrongQuestionCount}</span>
                              </span>
                              {isAdmin && (
                                <span className="cm-btns">
                                  <button className="cm-btn cm-btn-sm" onClick={() => renameSection(s.id, s.title)}>
                                    重命名
                                  </button>
                                  <button
                                    className="cm-btn cm-btn-sm cm-btn-danger"
                                    onClick={() => removeSection(s.id, s.title)}
                                  >
                                    删除
                                  </button>
                                </span>
                              )}
                            </div>
                          ))}
                          {c.sections.length === 0 && <div className="cm-none">该章暂无小节</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              {bookOpen && b.chapters.length === 0 && <div className="cm-none">该教材暂无章节</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
