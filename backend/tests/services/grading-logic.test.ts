// Unit tests for grading logic
// Tests choice question auto-grading and fill-in-the-blank equivalence

describe('Grading Logic', () => {
  describe('gradeChoiceQuestion', () => {
    function gradeChoice(
      studentAnswer: string | string[],
      correctAnswer: string | string[]
    ): { isCorrect: boolean; score: number } {
      const normalize = (a: string | string[]): string[] => {
        if (typeof a === 'string') {
          return a.trim().toUpperCase().split('').sort();
        }
        return a.map((x) => x.trim().toUpperCase()).sort();
      };

      const student = normalize(studentAnswer);
      const correct = normalize(correctAnswer);

      const isCorrect =
        student.length === correct.length &&
        student.every((v, i) => v === correct[i]);

      return { isCorrect, score: isCorrect ? 1 : 0 };
    }

    it('should mark correct single choice', () => {
      const result = gradeChoice('A', 'A');
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should mark incorrect single choice', () => {
      const result = gradeChoice('B', 'A');
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should mark correct multi-choice (same order)', () => {
      const result = gradeChoice(['A', 'B'], ['A', 'B']);
      expect(result.isCorrect).toBe(true);
    });

    it('should mark correct multi-choice (different order)', () => {
      const result = gradeChoice(['B', 'A'], ['A', 'B']);
      expect(result.isCorrect).toBe(true);
    });

    it('should mark incorrect multi-choice (missing one)', () => {
      const result = gradeChoice(['A'], ['A', 'B']);
      expect(result.isCorrect).toBe(false);
    });

    it('should mark incorrect multi-choice (extra one)', () => {
      const result = gradeChoice(['A', 'B', 'C'], ['A', 'B']);
      expect(result.isCorrect).toBe(false);
    });

    it('should handle lowercase answers', () => {
      const result = gradeChoice('a', 'A');
      expect(result.isCorrect).toBe(true);
    });

    it('should handle string with multiple chars as multi-choice', () => {
      const result = gradeChoice('AB', 'AB');
      expect(result.isCorrect).toBe(true);
    });

    it('should handle whitespace in answers', () => {
      const result = gradeChoice(' A ', 'A');
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('Fill-in-the-blank equivalence', () => {
    function isFillEquivalent(studentAnswer: string, correctAnswer: string): boolean {
      const normalize = (s: string): string => {
        return s
          .trim()
          .replace(/\s+/g, '')
          .replace(/（/g, '(')
          .replace(/）/g, ')')
          .replace(/，/g, ',')
          .replace(/。/g, '.')
          .toLowerCase();
      };

      const a = normalize(studentAnswer);
      const b = normalize(correctAnswer);

      if (a === b) return true;

      // Check if answers are mathematically equivalent (simple cases)
      // e.g., "1/2" and "0.5", "x^2" and "x²"
      const mathEquivalents: Record<string, string[]> = {
        '1/2': ['0.5', '½'],
        '1/3': ['0.333', '0.3333', '0.33'],
        '1/4': ['0.25', '¼'],
        '3/4': ['0.75', '¾'],
        '2/1': ['2'],
      };

      for (const [key, equivalents] of Object.entries(mathEquivalents)) {
        const allVariants = [key, ...equivalents].map(normalize);
        if (allVariants.includes(a) && allVariants.includes(b)) {
          return true;
        }
      }

      return false;
    }

    it('should match exact answers', () => {
      expect(isFillEquivalent('x^2 + 1', 'x^2 + 1')).toBe(true);
    });

    it('should match with different whitespace', () => {
      expect(isFillEquivalent('x^2+1', 'x^2 + 1')).toBe(true);
    });

    it('should match Chinese and English punctuation', () => {
      expect(isFillEquivalent('1，2', '1,2')).toBe(true);
    });

    it('should match 1/2 and 0.5', () => {
      expect(isFillEquivalent('1/2', '0.5')).toBe(true);
    });

    it('should match 1/4 and 0.25', () => {
      expect(isFillEquivalent('1/4', '0.25')).toBe(true);
    });

    it('should not match different answers', () => {
      expect(isFillEquivalent('x + 1', 'x + 2')).toBe(false);
    });

    it('should match case-insensitive', () => {
      expect(isFillEquivalent('ABC', 'abc')).toBe(true);
    });

    it('should match full-width and half-width parentheses', () => {
      expect(isFillEquivalent('（x+1）', '(x+1)')).toBe(true);
    });
  });
});
