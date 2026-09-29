/**
 * Paper Metadata Auto-Extraction Service
 *
 * Extracts paper metadata (title, year, region, examType, totalScore, duration)
 * from the filename and/or parsed Markdown content (MinerU output).
 * User-provided form values take priority over extracted values.
 */

export interface PaperMetadata {
  title?: string;
  year?: number | null;
  region?: string | null;
  examType?: string | null;
  totalScore?: number | null;
  duration?: number | null;
  subject?: string | null;
}

/** Standard Chinese exam type keywords (longest-first for priority) */
const EXAM_TYPE_KEYWORDS: Array<{ type: string; patterns: RegExp[] }> = [
  { type: '高考', patterns: [/普通高等学校招生全国统一考试/, /高考/] },
  { type: '中考', patterns: [/中考/] },
  { type: '模拟考试', patterns: [/模拟/] },
  { type: '期末考试', patterns: [/期末/] },
  { type: '期中考试', patterns: [/期中/] },
  { type: '月考', patterns: [/月考/] },
  { type: '学业水平测试', patterns: [/会考|学业水平|学业合格/] },
  { type: '联考', patterns: [/联考/] },
];

const REGION_KEYWORDS = [
  '全国', '新课标', '北京', '上海', '天津', '重庆', '广东', '江苏', '浙江', '山东',
  '河南', '河北', '湖南', '湖北', '四川', '福建', '陕西', '辽宁', '吉林', '黑龙江',
  '山西', '江西', '广西', '云南', '贵州', '海南', '内蒙古', '新疆', '西藏', '甘肃',
  '青海', '宁夏', '安徽', '台湾', '香港', '澳门',
];

/**
 * Subject keywords (学科) mapped from filename/content text.
 * Longest patterns first so 理综 is matched before 物/化/生 standalone words.
 */
const SUBJECT_KEYWORDS: Array<{ subject: string; patterns: RegExp[] }> = [
  { subject: '理综', patterns: [/理综|理科综合/] },
  { subject: '文综', patterns: [/文综|文科综合/] },
  { subject: '数学', patterns: [/数学/] },
  { subject: '语文', patterns: [/语文/] },
  { subject: '英语', patterns: [/英语|英语（含听力）/] },
  { subject: '物理', patterns: [/物理/] },
  { subject: '化学', patterns: [/化学/] },
  { subject: '生物', patterns: [/生物/] },
  { subject: '政治', patterns: [/政治/] },
  { subject: '历史', patterns: [/历史/] },
  { subject: '地理', patterns: [/地理/] },
];

/** 4-digit year like 2010, 2024, 2026 */
const YEAR_REGEX = /\b(19|20)\d{2}\b/g;

const DURATION_REGEXES = [
  /(?:考试|作答|测试)(?:时间|时长)[：:]?\s*(\d{1,3})\s*分钟/,
  /(\d{1,3})\s*分钟(?:内)?(?:完成|作答)/,
];

/** Whole-score markers like 满分150分, 共150分, 总分150 */
const FULL_SCORE_REGEXES = [
  /(?:满分|总分|共计|全部为|卷面)\s*[（(]?(\d{2,3})\s*分/,
  /(\d{2,3})\s*分\s*(?:满分|卷面)/,
];

/** Section header like 一、单项选择题（本题共8小题，每小题5分，共40分） */
const SECTION_SCORE_REGEX =
  /[一二三四五六七八九十]+\s*[、.．]?\s*[^\n（(]{0,20}[（(]\s*本题\s*共\s*(\d{1,2})\s*小题[，,、]?\s*每小题\s*(\d{1,3}(?:\.\d+)?)\s*分/g;

/** First level-1 heading in markdown (title) */
const MD_TITLE_REGEX = /^#\s+(.+)$/m;

/**
 * Extract a 4-digit year from text (first match).
 */
function extractYearFromText(text: string): number | null {
  if (!text) return null;
  const matches = text.match(YEAR_REGEX);
  if (!matches || matches.length === 0) return null;
  return parseInt(matches[0], 10);
}

/**
 * Extract subject (学科) from text (first keyword match, longest-priority).
 */
function extractSubjectFromText(text: string): string | null {
  if (!text) return null;
  for (const entry of SUBJECT_KEYWORDS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) return entry.subject;
    }
  }
  return null;
}

/**
 * Extract exam type from text (first keyword match).
 */
function extractExamTypeFromText(text: string): string | null {
  if (!text) return null;
  for (const entry of EXAM_TYPE_KEYWORDS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) return entry.type;
    }
  }
  return null;
}

/**
 * Extract region from text (first region keyword match).
 */
function extractRegionFromText(text: string): string | null {
  if (!text) return null;
  for (const region of REGION_KEYWORDS) {
    // Match as part of "全国卷" / "新课标卷" / "北京卷" style names
    const pattern = new RegExp(`${region}\\s*[ⅠII一二两]*\\s*[A-Za-z]?\\s*[卷套]?`);
    if (pattern.test(text)) return region;
  }
  return null;
}

/**
 * Extract total score from Markdown section headers.
 * Sums 小题数 × 每小题分 across all sections; falls back to explicit 满分X分.
 */
export function extractTotalScoreFromMarkdown(markdown: string): number | null {
  if (!markdown) return null;

  // Explicit full-score marker first (authoritative)
  for (const regex of FULL_SCORE_REGEXES) {
    const m = markdown.match(regex);
    if (m) return parseInt(m[1], 10);
  }

  // Sum section-level scores: 本题共N小题，每小题X分 → N×X
  let total = 0;
  SECTION_SCORE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SECTION_SCORE_REGEX.exec(markdown)) !== null) {
    const count = parseInt(match[1], 10);
    const perScore = parseFloat(match[2]);
    if (!isNaN(count) && !isNaN(perScore) && count > 0 && count <= 50) {
      total += count * perScore;
    }
  }
  return total > 0 ? total : null;
}

/**
 * Extract duration (minutes) from text.
 */
function extractDurationFromText(text: string): number | null {
  if (!text) return null;
  for (const regex of DURATION_REGEXES) {
    const m = text.match(regex);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Extract title from markdown (first # heading), cleaned up.
 */
function extractTitleFromMarkdown(markdown: string): string | null {
  if (!markdown) return null;
  const m = markdown.match(MD_TITLE_REGEX);
  if (!m || !m[1]) return null;
  let title = m[1].trim();
  // Strip trailing ornament like 含答案解析 / （含解析） / 真题 etc.
  title = title.replace(/[（(]?[含附]?[答案解|解析][答]*[）)]?$/, '').trim();
  return title || null;
}

/** Default title from filename (without extension) */
function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}

/**
 * Main entry: extract metadata from filename + markdown content.
 * userProvided fields (explicitly given by user form) take priority.
 * Returns a complete metadata object (nulls for unknown fields).
 */
export function autoExtractMetadata(params: {
  filename: string;
  markdown?: string | null;
  userProvided?: Partial<PaperMetadata>;
}): PaperMetadata {
  const { filename, markdown, userProvided } = params;
  const filenameBase = titleFromFilename(filename);
  const textPool = `${filename}\n${markdown || ''}`;

  // Title: user > markdown # heading > filename
  let title = userProvided?.title;
  if (!title) title = extractTitleFromMarkdown(markdown || '') || filenameBase;

  // Year: user > filename/content 4-digit year
  let year = userProvided?.year !== undefined ? userProvided.year : null;
  if (!year) year = extractYearFromText(textPool);

  // Region: user > filename/content region keyword
  let region = userProvided?.region || null;
  if (!region) region = extractRegionFromText(textPool);

  // ExamType: user > keyword match > 'practice'
  let examType = userProvided?.examType || null;
  if (!examType) examType = extractExamTypeFromText(textPool) || 'practice';

  // Subject: user > filename/content keyword match
  let subject = userProvided?.subject || null;
  if (!subject) subject = extractSubjectFromText(textPool);

  // TotalScore: user > markdown sections / 满分
  let totalScore = userProvided?.totalScore !== undefined ? userProvided.totalScore : null;
  if (!totalScore) totalScore = extractTotalScoreFromMarkdown(markdown || '');

  // Duration: user > markdown/filename 时长
  let duration = userProvided?.duration !== undefined ? userProvided.duration : null;
  if (!duration) duration = extractDurationFromText(textPool);

  return {
    title: title || filenameBase,
    year: year ?? null,
    region: region ?? 'Unknown',
    examType: examType ?? 'practice',
    totalScore: totalScore ?? null,
    duration: duration ?? null,
    subject: subject ?? null,
  };
}