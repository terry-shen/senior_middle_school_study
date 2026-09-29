/**
 * Unit tests for paper-metadata-service auto-extraction,
 * focusing on subject (学科) keyword recognition added by paper-library-restructure.
 */
import { autoExtractMetadata } from '../../src/services/paper-metadata-service';

describe('autoExtractMetadata subject recognition', () => {
  it('extracts 数学 from filename', () => {
    const meta = autoExtractMetadata({ filename: '2010年高考数学陕西卷.doc', markdown: null });
    expect(meta.subject).toBe('数学');
    expect(meta.year).toBe(2010);
    expect(meta.region).toBe('陕西');
  });

  it('extracts 理综 from filename (before individual subject words)', () => {
    const meta = autoExtractMetadata({ filename: '2010年高考理综全国卷.doc', markdown: null });
    expect(meta.subject).toBe('理综');
  });

  it('extracts 文综 from filename', () => {
    const meta = autoExtractMetadata({ filename: '2020年文综试卷.docx', markdown: null });
    expect(meta.subject).toBe('文综');
  });

  it('extracts 英语 from filename', () => {
    const meta = autoExtractMetadata({ filename: '2021年高考英语天津卷.pdf', markdown: null });
    expect(meta.subject).toBe('英语');
  });

  it('extracts 物理/化学/生物 individually', () => {
    expect(autoExtractMetadata({ filename: '物理试卷.doc', markdown: null }).subject).toBe('物理');
    expect(autoExtractMetadata({ filename: '化学试卷.doc', markdown: null }).subject).toBe('化学');
    expect(autoExtractMetadata({ filename: '生物试卷.doc', markdown: null }).subject).toBe('生物');
  });

  it('returns null subject for unknown text', () => {
    const meta = autoExtractMetadata({ filename: '2010年真题合集.doc', markdown: null });
    expect(meta.subject).toBeNull();
  });

  it('user-provided subject takes priority over filename', () => {
    const meta = autoExtractMetadata({
      filename: '2010年高考数学陕西卷.doc',
      markdown: null,
      userProvided: { subject: '物理' as any },
    });
    expect(meta.subject).toBe('物理');
  });

  it('extracts subject from markdown content too', () => {
    const meta = autoExtractMetadata({
      filename: '2010年高考真题.doc',
      markdown: '## 2010年高考英语试题\n\n一、听力...',
    });
    expect(meta.subject).toBe('英语');
  });

  it('keeps existing field extraction intact (year/region/examType/score)', () => {
    const meta = autoExtractMetadata({
      filename: '2024年广东省高考数学卷.docx',
      markdown: '满分150分\n考试时长120分钟\n一、单项选择题（本题共8小题，每小题5分，共40分）\n二、填空题（本题共4小题，每小题5分，共20分）',
    });
    expect(meta.subject).toBe('数学');
    expect(meta.year).toBe(2024);
    expect(meta.region).toBe('广东');
    expect(meta.examType).toBe('高考');
  });
});