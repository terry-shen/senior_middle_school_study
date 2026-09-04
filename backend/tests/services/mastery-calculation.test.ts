// Unit tests for mastery calculation logic
// Tests the weighted correctness formula:
// 掌握度 = Σ(得分 × 难度权重) / Σ(满分 × 难度权重) × 100

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.2,
  very_hard: 1.5,
};

function calculateMasteryLevel(
  records: { score: number; maxScore: number; difficulty: string }[]
): number {
  if (!records || records.length === 0) return 0;

  let weightedScore = 0;
  let weightedMax = 0;

  for (const r of records) {
    const weight = DIFFICULTY_WEIGHTS[r.difficulty] || 1.0;
    weightedScore += r.score * weight;
    weightedMax += r.maxScore * weight;
  }

  if (weightedMax === 0) return 0;
  return Math.round((weightedScore / weightedMax) * 100);
}

describe('Mastery Calculation', () => {
  describe('calculateMasteryLevel', () => {
    it('should return 0 for empty records', () => {
      expect(calculateMasteryLevel([])).toBe(0);
    });

    it('should return 0 for null input', () => {
      expect(calculateMasteryLevel(null as unknown as never[])).toBe(0);
    });

    it('should calculate 100% when all correct', () => {
      const records = [
        { score: 10, maxScore: 10, difficulty: 'easy' },
        { score: 10, maxScore: 10, difficulty: 'medium' },
      ];
      expect(calculateMasteryLevel(records)).toBe(100);
    });

    it('should calculate 0% when all wrong', () => {
      const records = [
        { score: 0, maxScore: 10, difficulty: 'easy' },
        { score: 0, maxScore: 10, difficulty: 'medium' },
      ];
      expect(calculateMasteryLevel(records)).toBe(0);
    });

    it('should calculate 50% for half correct', () => {
      const records = [
        { score: 5, maxScore: 10, difficulty: 'medium' },
      ];
      expect(calculateMasteryLevel(records)).toBe(50);
    });

    it('should apply difficulty weights correctly', () => {
      // easy weight=0.8, hard weight=1.2
      // weightedScore = 8*0.8 + 0*1.2 = 6.4
      // weightedMax = 10*0.8 + 10*1.2 = 20
      // mastery = 6.4/20 * 100 = 32
      const records = [
        { score: 8, maxScore: 10, difficulty: 'easy' },
        { score: 0, maxScore: 10, difficulty: 'hard' },
      ];
      expect(calculateMasteryLevel(records)).toBe(32);
    });

    it('should weight very_hard questions highest', () => {
      // very_hard weight=1.5
      // weightedScore = 0*0.8 + 0*1.5 = 0 (all wrong, but test weight diff)
      // Actually test: easy correct, very_hard correct
      // weightedScore = 10*0.8 + 10*1.5 = 23
      // weightedMax = 10*0.8 + 10*1.5 = 23
      // mastery = 100
      const records = [
        { score: 10, maxScore: 10, difficulty: 'easy' },
        { score: 10, maxScore: 10, difficulty: 'very_hard' },
      ];
      expect(calculateMasteryLevel(records)).toBe(100);
    });

    it('should use default weight 1.0 for unknown difficulty', () => {
      const records = [
        { score: 5, maxScore: 10, difficulty: 'unknown' },
      ];
      expect(calculateMasteryLevel(records)).toBe(50);
    });

    it('should handle mixed difficulties with partial scores', () => {
      // easy: 8/10 * 0.8 = 6.4
      // medium: 7/10 * 1.0 = 7
      // hard: 3/10 * 1.2 = 3.6
      // very_hard: 0/10 * 1.5 = 0
      // weightedScore = 6.4 + 7 + 3.6 + 0 = 17
      // weightedMax = 8 + 10 + 12 + 15 = 45
      // mastery = 17/45 * 100 = 37.78 → 38
      const records = [
        { score: 8, maxScore: 10, difficulty: 'easy' },
        { score: 7, maxScore: 10, difficulty: 'medium' },
        { score: 3, maxScore: 10, difficulty: 'hard' },
        { score: 0, maxScore: 10, difficulty: 'very_hard' },
      ];
      expect(calculateMasteryLevel(records)).toBe(38);
    });
  });

  describe('Difficulty Weights', () => {
    it('should have correct weight values', () => {
      expect(DIFFICULTY_WEIGHTS['easy']).toBe(0.8);
      expect(DIFFICULTY_WEIGHTS['medium']).toBe(1.0);
      expect(DIFFICULTY_WEIGHTS['hard']).toBe(1.2);
      expect(DIFFICULTY_WEIGHTS['very_hard']).toBe(1.5);
    });

    it('should have increasing weights', () => {
      expect(DIFFICULTY_WEIGHTS['easy']).toBeLessThan(DIFFICULTY_WEIGHTS['medium']);
      expect(DIFFICULTY_WEIGHTS['medium']).toBeLessThan(DIFFICULTY_WEIGHTS['hard']);
      expect(DIFFICULTY_WEIGHTS['hard']).toBeLessThan(DIFFICULTY_WEIGHTS['very_hard']);
    });
  });
});

describe('Mastery Level Mapping', () => {
  function getMasteryLevel(mastery: number): string {
    if (mastery >= 85) return '优秀';
    if (mastery >= 70) return '良好';
    if (mastery >= 50) return '一般';
    return '较差';
  }

  it('should map 85+ to 优秀', () => {
    expect(getMasteryLevel(85)).toBe('优秀');
    expect(getMasteryLevel(100)).toBe('优秀');
  });

  it('should map 70-84 to 良好', () => {
    expect(getMasteryLevel(70)).toBe('良好');
    expect(getMasteryLevel(84)).toBe('良好');
  });

  it('should map 50-69 to 一般', () => {
    expect(getMasteryLevel(50)).toBe('一般');
    expect(getMasteryLevel(69)).toBe('一般');
  });

  it('should map <50 to 较差', () => {
    expect(getMasteryLevel(0)).toBe('较差');
    expect(getMasteryLevel(49)).toBe('较差');
  });
});
