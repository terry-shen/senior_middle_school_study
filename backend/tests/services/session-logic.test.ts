import {
  activeDeltaSec,
  beijingDateKey,
  HEARTBEAT_MAX_SEC,
  SESSION_DISCONNECT_MS,
  SESSION_IDLE_MS,
} from '../../src/services/session-service';

describe('Session usage logic', () => {
  describe('activeDeltaSec', () => {
    it('counts elapsed seconds between heartbeats', () => {
      const last = new Date('2026-11-24T00:00:00.000Z');
      const now = new Date('2026-11-24T00:00:25.000Z');
      expect(activeDeltaSec(last, now)).toBe(25);
    });

    it('never charges more than 60 seconds for one heartbeat', () => {
      const last = new Date('2026-11-24T00:00:00.000Z');
      const now = new Date('2026-11-24T00:45:00.000Z');
      expect(activeDeltaSec(last, now)).toBe(HEARTBEAT_MAX_SEC);
    });

    it('returns zero for clock skew or non-positive elapsed time', () => {
      const now = new Date('2026-11-24T00:00:00.000Z');
      const last = new Date('2026-11-24T00:00:10.000Z');
      expect(activeDeltaSec(last, now)).toBe(0);
    });

    it('rounds sub-second remainders to a whole second', () => {
      const last = new Date('2026-11-24T00:00:00.000Z');
      const now = new Date('2026-11-24T00:00:00.600Z');
      expect(activeDeltaSec(last, now)).toBe(1);
    });
  });

  describe('Beijing date key', () => {
    it('rolls over at UTC 16:00 (Beijing midnight)', () => {
      expect(beijingDateKey(new Date('2026-11-24T15:59:59.000Z'))).toBe('2026-11-24');
      expect(beijingDateKey(new Date('2026-11-24T16:00:00.000Z'))).toBe('2026-11-25');
    });
  });

  describe('timing constants', () => {
    it('warns at 29 minutes and logs out at 30 minutes', () => {
      expect(SESSION_IDLE_MS).toBe(30 * 60 * 1000);
    });

    it('treats 3 minutes without presence as offline', () => {
      expect(SESSION_DISCONNECT_MS).toBe(3 * 60 * 1000);
    });
  });
});
