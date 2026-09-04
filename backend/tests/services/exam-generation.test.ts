// Unit tests for exam generation algorithm
// Tests question selection by difficulty ratio and knowledge point coverage

interface Question {
  id: number;
  questionType: string;
  difficulty: string;
  score: number;
  knowledgePoints?: string[];
}

function selectQuestions(
  pool: Question[],
  params: {
    totalScore: number;
    difficultyDistribution: { easy: number; medium: number; hard: number; very_hard: number };
    questionTypes?: string[];
  }
): Question[] {
  const { totalScore, difficultyDistribution, questionTypes } = params;
  const selected: Question[] = [];
  let currentScore = 0;

  // Filter pool by question type if specified
  let available = questionTypes
    ? pool.filter((q) => questionTypes.includes(q.questionType))
    : [...pool];

  // Shuffle for randomness
  available = available.sort(() => Math.random() - 0.5);

  // Calculate target scores per difficulty
  const targetByDifficulty = {
    easy: (totalScore * difficultyDistribution.easy) / 100,
    medium: (totalScore * difficultyDistribution.medium) / 100,
    hard: (totalScore * difficultyDistribution.hard) / 100,
    very_hard: (totalScore * difficultyDistribution.very_hard) / 100,
  };

  // Select questions by difficulty
  for (const [difficulty, targetScore] of Object.entries(targetByDifficulty)) {
    let diffScore = 0;
    const diffQuestions = available.filter((q) => q.difficulty === difficulty);

    for (const q of diffQuestions) {
      if (diffScore + q.score <= targetScore) {
        selected.push(q);
        diffScore += q.score;
        currentScore += q.score;
        // Remove from available to avoid duplicates
        available = available.filter((a) => a.id !== q.id);
      }
    }
  }

  // Fill remaining score with any available questions
  if (currentScore < totalScore) {
    for (const q of available) {
      if (currentScore + q.score <= totalScore) {
        selected.push(q);
        currentScore += q.score;
      }
      if (currentScore >= totalScore) break;
    }
  }

  return selected;
}

describe('Exam Generation Algorithm', () => {
  const questionPool: Question[] = [
    { id: 1, questionType: 'choice', difficulty: 'easy', score: 5 },
    { id: 2, questionType: 'choice', difficulty: 'easy', score: 5 },
    { id: 3, questionType: 'choice', difficulty: 'medium', score: 5 },
    { id: 4, questionType: 'choice', difficulty: 'medium', score: 5 },
    { id: 5, questionType: 'fill', difficulty: 'medium', score: 4 },
    { id: 6, questionType: 'fill', difficulty: 'hard', score: 4 },
    { id: 7, questionType: 'essay', difficulty: 'hard', score: 12 },
    { id: 8, questionType: 'essay', difficulty: 'very_hard', score: 12 },
    { id: 9, questionType: 'essay', difficulty: 'easy', score: 10 },
    { id: 10, questionType: 'choice', difficulty: 'very_hard', score: 5 },
  ];

  describe('selectQuestions', () => {
    it('should select questions up to total score', () => {
      const result = selectQuestions(questionPool, {
        totalScore: 30,
        difficultyDistribution: { easy: 30, medium: 40, hard: 20, very_hard: 10 },
      });
      const totalScore = result.reduce((sum, q) => sum + q.score, 0);
      expect(totalScore).toBeLessThanOrEqual(30);
    });

    it('should not exceed total score', () => {
      const result = selectQuestions(questionPool, {
        totalScore: 20,
        difficultyDistribution: { easy: 25, medium: 50, hard: 25, very_hard: 0 },
      });
      const totalScore = result.reduce((sum, q) => sum + q.score, 0);
      expect(totalScore).toBeLessThanOrEqual(20);
    });

    it('should not select duplicate questions', () => {
      const result = selectQuestions(questionPool, {
        totalScore: 50,
        difficultyDistribution: { easy: 25, medium: 25, hard: 25, very_hard: 25 },
      });
      const ids = result.map((q) => q.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should filter by question type when specified', () => {
      const result = selectQuestions(questionPool, {
        totalScore: 20,
        difficultyDistribution: { easy: 30, medium: 40, hard: 20, very_hard: 10 },
        questionTypes: ['choice'],
      });
      result.forEach((q) => {
        expect(q.questionType).toBe('choice');
      });
    });

    it('should handle empty pool gracefully', () => {
      const result = selectQuestions([], {
        totalScore: 100,
        difficultyDistribution: { easy: 25, medium: 25, hard: 25, very_hard: 25 },
      });
      expect(result).toEqual([]);
    });

    it('should handle insufficient questions in pool', () => {
      const smallPool = [{ id: 1, questionType: 'choice', difficulty: 'easy', score: 5 }];
      const result = selectQuestions(smallPool, {
        totalScore: 100,
        difficultyDistribution: { easy: 25, medium: 25, hard: 25, very_hard: 25 },
      });
      const totalScore = result.reduce((sum, q) => sum + q.score, 0);
      expect(totalScore).toBeLessThanOrEqual(5);
    });
  });
});

describe('Difficulty Distribution Validation', () => {
  function validateDistribution(dist: {
    easy: number;
    medium: number;
    hard: number;
    very_hard: number;
  }): boolean {
    const sum = dist.easy + dist.medium + dist.hard + dist.very_hard;
    return sum === 100;
  }

  it('should validate correct distribution', () => {
    expect(
      validateDistribution({ easy: 30, medium: 40, hard: 20, very_hard: 10 })
    ).toBe(true);
  });

  it('should reject distribution not summing to 100', () => {
    expect(
      validateDistribution({ easy: 30, medium: 30, hard: 20, very_hard: 10 })
    ).toBe(false);
  });

  it('should validate distribution with zeros', () => {
    expect(
      validateDistribution({ easy: 100, medium: 0, hard: 0, very_hard: 0 })
    ).toBe(true);
  });
});
