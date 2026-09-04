// Unit tests for recommendation scoring algorithm
// Tests the scoring logic based on mastery level, wrong questions, and difficulty adaptation

interface ScoredQuestion {
  questionId: number;
  score: number;
  reasons: string[];
}

describe('Recommendation Scoring Algorithm', () => {
  function computeScore(
    params: {
      masteryLevel: number;
      wrongCount: number;
      difficulty: string;
      alreadyPracticed: boolean;
      daysSinceLastPractice: number;
    }
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Mastery-based scoring (weak points get higher score)
    if (params.masteryLevel < 60) {
      score += 40;
      reasons.push(`掌握度低(${params.masteryLevel})，需要加强`);
    } else if (params.masteryLevel < 70) {
      score += 20;
      reasons.push(`掌握度一般(${params.masteryLevel})，可以提升`);
    } else {
      score += 5;
      reasons.push(`掌握度良好(${params.masteryLevel})`);
    }

    // 2. Wrong question bonus
    if (params.wrongCount > 0) {
      score += Math.min(params.wrongCount * 10, 30);
      reasons.push(`错题${params.wrongCount}次`);
    }

    // 3. Difficulty adaptation (recent development zone)
    const difficultyWeight: Record<string, number> = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
      very_hard: 1.5,
    };

    if (params.masteryLevel < 50 && params.difficulty === 'hard') {
      score *= 0.5;
      reasons.push('难度过高，暂不推荐');
    } else if (params.masteryLevel >= 85 && params.difficulty === 'easy') {
      score *= 0.3;
      reasons.push('难度过低，不推荐');
    }

    score *= difficultyWeight[params.difficulty] || 1.0;

    // 4. Penalize already practiced questions
    if (params.alreadyPracticed) {
      score *= 0.1;
      reasons.push('已练习过');
    }

    // 5. Boost questions not practiced recently
    if (params.daysSinceLastPractice > 7) {
      score += 10;
      reasons.push('长时间未练习');
    }

    return { score: Math.round(score), reasons };
  }

  describe('computeScore - mastery-based scoring', () => {
    it('should score weak mastery higher', () => {
      const weak = computeScore({
        masteryLevel: 30,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const strong = computeScore({
        masteryLevel: 90,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      expect(weak.score).toBeGreaterThan(strong.score);
    });

    it('should add bonus for wrong questions', () => {
      const noWrong = computeScore({
        masteryLevel: 50,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const withWrong = computeScore({
        masteryLevel: 50,
        wrongCount: 3,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      expect(withWrong.score).toBeGreaterThan(noWrong.score);
    });

    it('should cap wrong question bonus at 30', () => {
      const many = computeScore({
        masteryLevel: 50,
        wrongCount: 10,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const more = computeScore({
        masteryLevel: 50,
        wrongCount: 100,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      // Both should have the same bonus (capped at 30)
      expect(many.score).toBe(more.score);
    });

    it('should penalize already practiced questions', () => {
      const notPracticed = computeScore({
        masteryLevel: 50,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const practiced = computeScore({
        masteryLevel: 50,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: true,
        daysSinceLastPractice: 0,
      });
      expect(practiced.score).toBeLessThan(notPracticed.score);
    });

    it('should boost questions not practiced recently', () => {
      const recent = computeScore({
        masteryLevel: 50,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 1,
      });
      const old = computeScore({
        masteryLevel: 50,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 10,
      });
      expect(old.score).toBeGreaterThan(recent.score);
    });

    it('should reduce score for too-hard questions when mastery is low', () => {
      const appropriate = computeScore({
        masteryLevel: 30,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const tooHard = computeScore({
        masteryLevel: 30,
        wrongCount: 0,
        difficulty: 'hard',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      // hard is penalized by 0.5 when mastery < 50
      // but hard also has weight 1.2 vs medium 1.0
      // net: 40 * 0.5 * 1.2 = 24 vs 40 * 1.0 = 40
      expect(tooHard.score).toBeLessThan(appropriate.score);
    });

    it('should reduce score for too-easy questions when mastery is high', () => {
      const easyForStrong = computeScore({
        masteryLevel: 90,
        wrongCount: 0,
        difficulty: 'easy',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      const mediumForStrong = computeScore({
        masteryLevel: 90,
        wrongCount: 0,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 0,
      });
      expect(easyForStrong.score).toBeLessThan(mediumForStrong.score);
    });

    it('should include reasons in output', () => {
      const result = computeScore({
        masteryLevel: 40,
        wrongCount: 2,
        difficulty: 'medium',
        alreadyPracticed: false,
        daysSinceLastPractice: 10,
      });
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('掌握度'))).toBe(true);
    });
  });
});
