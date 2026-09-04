// Learning Incentive API Service

const API_BASE = 'http://localhost:3000/api/incentive';

export interface Badge {
  id: number;
  name: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  type: string;
  conditionType: string;
  conditionValue: number;
  rarity: string;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface UserBadge {
  id: number;
  studentId: number;
  badgeId: number;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
  badge: Badge;
}

export interface CheckIn {
  id: number;
  studentId: number;
  checkInDate: string;
  streakCount: number;
  summary: { practiceCount?: number; studyMinutes?: number; correctRate?: number };
}

export interface CheckInCalendar {
  checkIns: CheckIn[];
  currentStreak: number;
  totalCheckIns: number;
}

export interface LearningStats {
  totalPractice: number;
  correctCount: number;
  correctRate: number;
  totalStudyMinutes: number;
  badgesEarned: number;
  checkInDays: number;
  currentStreak: number;
  longestStreak: number;
  masteryImprovement: number;
}

export interface MasteryProgressPoint {
  date: string;
  avgMastery: number;
}

export interface LeaderboardEntry {
  studentId: number;
  displayName: string;
  className?: string;
  totalPractice: number;
  correctRate: number;
  currentStreak: number;
  badgesEarned: number;
  score: number;
  rank: number;
}

export interface AchievementWall {
  earnedBadges: UserBadge[];
  recentCheckIns: CheckIn[];
  perfectScores: { mockExamId: number; score: number; maxScore: number }[];
  masteryImprovements: { knowledgePointId: number; improvement: number }[];
  totalBadges: number;
  totalCheckIns: number;
  totalPerfectScores: number;
}

export interface IncentiveNotification {
  id: number;
  studentId: number;
  type: string;
  title: string;
  content: string;
  metadata: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Challenge {
  id: number;
  title: string;
  description: string | null;
  type: string;
  classId: number | null;
  organizerId: number;
  parameters: string;
  status: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  _count?: { participants: number };
  badges?: { id: number; badge: Badge }[];
}

export interface ChallengeParticipant {
  id: number;
  challengeId: number;
  studentId: number;
  progress: number;
  rank: number | null;
  joinedAt: string;
  student: { id: number; name: string };
}

export interface ChallengeDetail extends Challenge {
  organizer: { id: number; name: string };
  participants: ChallengeParticipant[];
}

export interface ChallengeLeaderboard {
  challenge: Challenge;
  leaderboard: { studentId: number; name: string; progress: number; rank: number }[];
}

function getAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ===== Badges =====

export async function getBadges(token: string, studentId?: number): Promise<Badge[]> {
  const url = studentId ? `${API_BASE}/badges?studentId=${studentId}` : `${API_BASE}/badges`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
}

export async function getEarnedBadges(token: string, studentId?: number): Promise<UserBadge[]> {
  const url = studentId ? `${API_BASE}/badges/earned?studentId=${studentId}` : `${API_BASE}/badges/earned`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
}

export async function seedDefaultBadges(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/badges/seed`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

export async function checkBadges(token: string, studentId?: number): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/badges/check`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ studentId }),
  });
  return response.json();
}

// ===== Check-ins =====

export async function checkIn(token: string): Promise<{ message: string; alreadyCheckedIn: boolean; data: CheckIn }> {
  const response = await fetch(`${API_BASE}/check-in`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

export async function hasCheckedInToday(token: string): Promise<{ checkedIn: boolean }> {
  const response = await fetch(`${API_BASE}/check-in/today`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getCheckInCalendar(
  token: string,
  studentId?: number,
  year?: number,
  month?: number
): Promise<CheckInCalendar> {
  const params = new URLSearchParams();
  if (studentId) params.append('studentId', String(studentId));
  if (year) params.append('year', String(year));
  if (month !== undefined) params.append('month', String(month));
  const response = await fetch(`${API_BASE}/check-in/calendar?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// ===== Stats =====

export async function getLearningStats(token: string, studentId?: number): Promise<LearningStats> {
  const url = studentId ? `${API_BASE}/stats?studentId=${studentId}` : `${API_BASE}/stats`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
}

export async function getMasteryProgressCurve(
  token: string,
  studentId?: number,
  days?: number
): Promise<MasteryProgressPoint[]> {
  const params = new URLSearchParams();
  if (studentId) params.append('studentId', String(studentId));
  if (days) params.append('days', String(days));
  const response = await fetch(`${API_BASE}/stats/mastery-curve?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

// ===== Leaderboard =====

export async function getClassLeaderboard(
  token: string,
  classId: number,
  anonymous = false
): Promise<LeaderboardEntry[]> {
  const response = await fetch(
    `${API_BASE}/leaderboard/class/${classId}?anonymous=${anonymous}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.json();
}

export async function getGlobalLeaderboard(
  token: string,
  anonymous = true,
  limit = 50
): Promise<LeaderboardEntry[]> {
  const response = await fetch(
    `${API_BASE}/leaderboard/global?anonymous=${anonymous}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.json();
}

// ===== Achievements =====

export async function getAchievementWall(token: string, studentId?: number): Promise<AchievementWall> {
  const url = studentId ? `${API_BASE}/achievements?studentId=${studentId}` : `${API_BASE}/achievements`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
}

// ===== Notifications =====

export async function getNotifications(token: string, unreadOnly = false): Promise<IncentiveNotification[]> {
  const response = await fetch(`${API_BASE}/notifications?unread=${unreadOnly}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function markNotificationRead(token: string, notificationId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

// ===== Challenges =====

export async function createChallenge(
  token: string,
  data: {
    title: string;
    description?: string;
    type: string;
    classId?: number;
    parameters?: Record<string, unknown>;
    startTime: string;
    endTime: string;
    badgeIds?: number[];
  }
): Promise<Challenge> {
  const response = await fetch(`${API_BASE}/challenges`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getChallenges(
  token: string,
  filters?: { organizerId?: number; classId?: number; status?: string }
): Promise<Challenge[]> {
  const params = new URLSearchParams();
  if (filters?.organizerId) params.append('organizerId', String(filters.organizerId));
  if (filters?.classId) params.append('classId', String(filters.classId));
  if (filters?.status) params.append('status', filters.status);
  const response = await fetch(`${API_BASE}/challenges?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getChallenge(token: string, id: number): Promise<ChallengeDetail> {
  const response = await fetch(`${API_BASE}/challenges/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function startChallenge(token: string, id: number): Promise<Challenge> {
  const response = await fetch(`${API_BASE}/challenges/${id}/start`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

export async function endChallenge(token: string, id: number): Promise<Challenge> {
  const response = await fetch(`${API_BASE}/challenges/${id}/end`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

export async function joinChallenge(token: string, id: number): Promise<ChallengeParticipant> {
  const response = await fetch(`${API_BASE}/challenges/${id}/join`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return response.json();
}

export async function getChallengeLeaderboard(token: string, id: number): Promise<ChallengeLeaderboard> {
  const response = await fetch(`${API_BASE}/challenges/${id}/leaderboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
