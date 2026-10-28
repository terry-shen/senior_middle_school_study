/**
 * Unit tests for paper-metadata-service auto-extraction,
 * focusing on subject (学科) recognition — dynamic from the Subject dictionary
 * table (subject-dimension change), with subjectCode/subjectId output.
 */
import { autoExtractMetadata } from '../../src/services/paper-metadata-service';

describe('autoExtractMetadata subject recognition', () => {
  it('extracts math from filename', async () => {
    const meta = await autoExtractMetadata({ filename: '2010年高考数学陕西卷.doc', markdown: null });
    expect(meta.subjectCode).toBe('math');
    expect(meta.year).toBe(2010);
    expect(meta.region).toBe('陕西');
  });

  it('extracts science (理综) from filename (before individual subject words)', async () => {
    const meta = await autoExtractMetadata({ filename: '2010年高考理综全国卷.doc', markdown: null });
    expect(meta.subjectCode).toBe('science');
  });

  it('extracts liberal_arts (文综) from filename', async () => {
    const meta = await autoExtractMetadata({ filename: '2020年文综试卷.docx', markdown: null });
    expect(meta.subjectCode).toBe('liberal_arts');
  });

  it('extracts english from filename', async () => {
    const meta = await autoExtractMetadata({ filename: '2021年高考英语天津卷.pdf', markdown: null });
    expect(meta.subjectCode).toBe('english');
  });

  it('extracts physics/chemistry/biology individually', async () => {
    expect((await autoExtractMetadata({ filename: '物理试卷.doc', markdown: null })).subjectCode).toBe('physics');
    expect((await autoExtractMetadata({ filename: '化学试卷.doc', markdown: null })).subjectCode).toBe('chemistry');
    expect((await autoExtractMetadata({ filename: '生物试卷.doc', markdown: null })).subjectCode).toBe('biology');
  });

  it('returns null subject for unknown text', async () => {
    const meta = await autoExtractMetadata({ filename: '2010年真题合集.doc', markdown: null });
    expect(meta.subjectCode).toBeNull();
  });

  it('user-provided subjectId takes priority over filename', async () => {
    const meta = await autoExtractMetadata({
      filename: '2010年高考数学陕西卷.doc',
      markdown: null,
      userProvided: { subjectId: 999 as any },
    });
    expect(meta.subjectId).toBe(999);
  });

  it('extracts subject from markdown content too', async () => {
    const meta = await autoExtractMetadata({
      filename: '2010年高考真题.doc',
      markdown: '## 2010年高考英语试题\n\n一、听力...',
    });
    expect(meta.subjectCode).toBe('english');
  });

  it('keeps existing field extraction intact (year/region/examType/score)', async () => {
    const meta = await autoExtractMetadata({
      filename: '2024年广东省高考数学卷.docx',
      markdown: '满分150分\n考试时长120分钟\n一、单项选择题（本题共8小题，每小题5分，共40分）\n二、填空题（本题共4小题，每小题5分，共20分）',
    });
    expect(meta.subjectCode).toBe('math');
    expect(meta.year).toBe(2024);
    expect(meta.region).toBe('广东');
    expect(meta.examType).toBe('高考');
  });
});
