import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getBadges,
  getCheckInCalendar,
  checkIn,
  hasCheckedInToday,
  getLearningStats,
  getGlobalLeaderboard,
  getAchievementWall,
  getNotifications,
  markNotificationRead,
  getChallenges,
  createChallenge,
  startChallenge,
  endChallenge,
  joinChallenge,
  getChallengeLeaderboard,
  seedDefaultBadges,
  type Badge,
  type CheckInCalendar,
  type LearningStats,
  type LeaderboardEntry,
  type AchievementWall,
  type IncentiveNotification,
  type Challenge,
} from '../services/incentive-api';
import './LearningIncentive.css';

const BADGE_ICONS: Record<string, string> = {
  practice: '📚',
  progress: '📈',
  persistence: '🔥',
  perfect_score: '🏆',
  breakthrough: '⚔️',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

type TabType = 'overview' | 'badges' | 'checkin' | 'leaderboard' | 'achievements' | 'challenges' | 'notifications';

export default function LearningIncentive() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [calendar, setCalendar] = useState<CheckInCalendar | null>(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementWall | null>(null);
  const [notifications, setNotifications] = useState<IncentiveNotification[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<{ name: string; progress: number; rank: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (user && token) {
      loadData();
    }
  }, [user, token]);

  useEffect(() => {
    if (token && activeTab === 'challenges' && challenges.length === 0) {
      loadChallenges();
    }
  }, [activeTab, token]);

  async function loadData() {
    if (!token || !user) return;
    setLoading(true);
    setError('');
    try {
      const [badgesData, calendarData, checkedIn, statsData, achievementsData, notifsData] = await Promise.all([
        getBadges(token, user.id),
        getCheckInCalendar(token, user.id),
        hasCheckedInToday(token),
        getLearningStats(token, user.id),
        getAchievementWall(token, user.id),
        getNotifications(token, false),
      ]);
      setBadges(badgesData);
      setCalendar(calendarData);
      setCheckedInToday(checkedIn.checkedIn);
      setStats(statsData);
      setAchievements(achievementsData);
      setNotifications(notifsData);
    } catch (err) {
      setError('Failed to load data: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    if (!token) return;
    try {
      const data = await getGlobalLeaderboard(token, true, 50);
      setLeaderboard(data);
    } catch (err) {
      setError('Failed to load leaderboard: ' + (err as Error).message);
    }
  }

  async function loadChallenges() {
    if (!token) return;
    try {
      const data = await getChallenges(token);
      setChallenges(data);
    } catch (err) {
      setError('Failed to load challenges: ' + (err as Error).message);
    }
  }

  async function handleCheckIn() {
    if (!token) return;
    try {
      const result = await checkIn(token);
      if (!result.alreadyCheckedIn) {
        setCheckedInToday(true);
        const newCalendar = await getCheckInCalendar(token, user?.id);
        setCalendar(newCalendar);
        const newStats = await getLearningStats(token, user?.id);
        setStats(newStats);
      }
    } catch (err) {
      setError('Failed to check in: ' + (err as Error).message);
    }
  }

  async function handleSeedBadges() {
    if (!token) return;
    try {
      await seedDefaultBadges(token);
      await loadData();
    } catch (err) {
      setError('Failed to seed badges: ' + (err as Error).message);
    }
  }

  async function handleMarkNotificationRead(id: number) {
    if (!token) return;
    try {
      await markNotificationRead(token, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      setError('Failed to mark notification: ' + (err as Error).message);
    }
  }

  async function handleChallengeLeaderboard(challengeId: number) {
    if (!token) return;
    try {
      const data = await getChallengeLeaderboard(token, challengeId);
      setChallengeLeaderboard(data.leaderboard);
      setSelectedChallengeId(challengeId);
    } catch (err) {
      setError('Failed to load challenge leaderboard: ' + (err as Error).message);
    }
  }

  async function handleStartChallenge(id: number) {
    if (!token) return;
    try {
      await startChallenge(token, id);
      await loadChallenges();
    } catch (err) {
      setError('Failed to start challenge: ' + (err as Error).message);
    }
  }

  async function handleEndChallenge(id: number) {
    if (!token) return;
    try {
      await endChallenge(token, id);
      await loadChallenges();
    } catch (err) {
      setError('Failed to end challenge: ' + (err as Error).message);
    }
  }

  async function handleJoinChallenge(id: number) {
    if (!token) return;
    try {
      await joinChallenge(token, id);
      await loadChallenges();
    } catch (err) {
      setError('Failed to join challenge: ' + (err as Error).message);
    }
  }

  if (loading && !stats) {
    return <div className="loading">加载中...</div>;
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '学习概览' },
    { id: 'badges', label: '徽章中心' },
    { id: 'checkin', label: '每日打卡' },
    { id: 'leaderboard', label: '排行榜' },
    { id: 'achievements', label: '成就墙' },
    { id: 'challenges', label: '挑战活动' },
    { id: 'notifications', label: `消息${notifications.filter(n => !n.isRead).length > 0 ? ` (${notifications.filter(n => !n.isRead).length})` : ''}` },
  ];

  return (
    <div className="incentive-page">
      <h1>学习激励中心</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'leaderboard' && leaderboard.length === 0) loadLeaderboard();
              if (tab.id === 'challenges' && challenges.length === 0) loadChallenges();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="overview-grid">
            <div className="stat-card">
              <div className="stat-icon">📝</div>
              <div className="stat-value">{stats.totalPractice}</div>
              <div className="stat-label">总练习题数</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.correctRate}%</div>
              <div className="stat-label">正确率</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-value">{stats.totalStudyMinutes}</div>
              <div className="stat-label">学习时长(分钟)</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏅</div>
              <div className="stat-value">{stats.badgesEarned}</div>
              <div className="stat-label">获得徽章</div>
            </div>
            <div className="stat-card highlight">
              <div className="stat-icon">🔥</div>
              <div className="stat-value">{stats.currentStreak}</div>
              <div className="stat-label">当前连续打卡</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-value">{stats.checkInDays}</div>
              <div className="stat-label">累计打卡天数</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-value">+{stats.masteryImprovement}</div>
              <div className="stat-label">30天掌握度提升</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value">{stats.longestStreak}</div>
              <div className="stat-label">最长连续打卡</div>
            </div>
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="badges-container">
            {isAdmin && badges.length === 0 && (
              <button className="btn-primary" onClick={handleSeedBadges}>
                初始化徽章系统
              </button>
            )}
            {['practice', 'progress', 'persistence', 'perfect_score', 'breakthrough'].map(type => {
              const typeBadges = badges.filter(b => b.type === type);
              if (typeBadges.length === 0) return null;
              const typeNames: Record<string, string> = {
                practice: '练习徽章',
                progress: '进步徽章',
                persistence: '毅力徽章',
                perfect_score: '满分徽章',
                breakthrough: '突破徽章',
              };
              return (
                <div key={type} className="badge-section">
                  <h3>{typeNames[type]}</h3>
                  <div className="badge-grid">
                    {typeBadges.map(badge => (
                      <div
                        key={badge.id}
                        className={`badge-card ${badge.earned ? 'earned' : 'locked'}`}
                        style={{ borderColor: RARITY_COLORS[badge.rarity] }}
                      >
                        <div className="badge-icon">{BADGE_ICONS[badge.type] || '🏅'}</div>
                        <div className="badge-name">{badge.displayName}</div>
                        <div className="badge-desc">{badge.description}</div>
                        <div className="badge-progress">
                          {badge.progress}/{badge.conditionValue}
                        </div>
                        {badge.earned && badge.earnedAt && (
                          <div className="badge-earned-date">
                            获得于 {new Date(badge.earnedAt).toLocaleDateString('zh-CN')}
                          </div>
                        )}
                        <div className="badge-rarity" style={{ color: RARITY_COLORS[badge.rarity] }}>
                          {badge.rarity === 'common' ? '普通' : badge.rarity === 'rare' ? '稀有' : badge.rarity === 'epic' ? '史诗' : '传说'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Check-in Tab */}
        {activeTab === 'checkin' && calendar && (
          <div className="checkin-container">
            <div className="checkin-header">
              <div className="streak-display">
                <div className="streak-icon">🔥</div>
                <div className="streak-info">
                  <div className="streak-number">{calendar.currentStreak}</div>
                  <div className="streak-label">天连续打卡</div>
                </div>
              </div>
              <button
                className={`btn-checkin ${checkedInToday ? 'done' : ''}`}
                onClick={handleCheckIn}
                disabled={checkedInToday}
              >
                {checkedInToday ? '今日已打卡 ✓' : '今日打卡'}
              </button>
            </div>

            <div className="checkin-stats">
              <div>累计打卡 {calendar.totalCheckIns} 天</div>
            </div>

            <div className="calendar-container">
              <h3>打卡日历 ({new Date().getFullYear()}年{new Date().getMonth() + 1}月)</h3>
              <div className="calendar-grid">
                {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                  <div key={day} className="calendar-weekday">{day}</div>
                ))}
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }, (_, i) => {
                  const date = i + 1;
                  const checkIn = calendar.checkIns.find(c => new Date(c.checkInDate).getDate() === date);
                  const isToday = date === new Date().getDate();
                  return (
                    <div
                      key={date}
                      className={`calendar-day ${checkIn ? 'checked-in' : ''} ${isToday ? 'today' : ''}`}
                    >
                      {date}
                      {checkIn && <span className="check-mark">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="checkin-rewards">
              <h3>打卡奖励</h3>
              <div className="rewards-grid">
                <div className="reward-card">
                  <div className="reward-icon">🔥</div>
                  <div>连续7天 → <strong>一周坚持</strong>徽章</div>
                </div>
                <div className="reward-card">
                  <div className="reward-icon">🔥</div>
                  <div>连续30天 → <strong>月度毅力</strong>徽章</div>
                </div>
                <div className="reward-card">
                  <div className="reward-icon">🔥</div>
                  <div>连续100天 → <strong>百日筑基</strong>徽章</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="leaderboard-container">
            <h3>全校排行榜（匿名）</h3>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>同学</th>
                  <th>班级</th>
                  <th>练习数</th>
                  <th>正确率</th>
                  <th>连续打卡</th>
                  <th>徽章</th>
                  <th>积分</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(entry => (
                  <tr key={entry.studentId} className={entry.rank <= 3 ? `rank-${entry.rank}` : ''}>
                    <td className="rank-cell">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </td>
                    <td>{entry.displayName}</td>
                    <td>{entry.className || '-'}</td>
                    <td>{entry.totalPractice}</td>
                    <td>{entry.correctRate}%</td>
                    <td>{entry.currentStreak}天</td>
                    <td>{entry.badgesEarned}</td>
                    <td><strong>{entry.score}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && achievements && (
          <div className="achievements-container">
            <div className="achievement-summary">
              <div className="summary-card">
                <div className="summary-icon">🏅</div>
                <div className="summary-value">{achievements.totalBadges}</div>
                <div className="summary-label">获得徽章</div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">📅</div>
                <div className="summary-value">{achievements.totalCheckIns}</div>
                <div className="summary-label">累计打卡</div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">🏆</div>
                <div className="summary-value">{achievements.totalPerfectScores}</div>
                <div className="summary-label">满分次数</div>
              </div>
            </div>

            <div className="achievement-section">
              <h3>🏅 获得的徽章</h3>
              <div className="achievement-badge-grid">
                {achievements.earnedBadges.length === 0 ? (
                  <p className="empty">还没有获得徽章，继续努力！</p>
                ) : (
                  achievements.earnedBadges.map(ub => (
                    <div key={ub.id} className="achievement-badge" style={{ borderColor: RARITY_COLORS[ub.badge.rarity] }}>
                      <div className="badge-icon">{BADGE_ICONS[ub.badge.type] || '🏅'}</div>
                      <div className="badge-name">{ub.badge.displayName}</div>
                      <div className="badge-earned-date">
                        {new Date(ub.earnedAt!).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="achievement-section">
              <h3>📈 掌握度提升</h3>
              <div className="improvement-list">
                {achievements.masteryImprovements.length === 0 ? (
                  <p className="empty">暂无进步记录</p>
                ) : (
                  achievements.masteryImprovements.map((imp, idx) => (
                    <div key={idx} className="improvement-item">
                      <span>记录 #{imp.knowledgePointId}</span>
                      <span className="improvement-value">+{imp.improvement}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="achievement-section">
              <h3>🏆 满分试卷</h3>
              {achievements.perfectScores.length === 0 ? (
                <p className="empty">还没有满分试卷，加油！</p>
              ) : (
                <div className="perfect-score-list">
                  {achievements.perfectScores.map((ps, idx) => (
                    <div key={idx} className="perfect-score-item">
                      模拟考试 #{ps.mockExamId} - {ps.score}/{ps.maxScore}分
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="achievement-section">
              <h3>📅 近期打卡</h3>
              <div className="recent-checkins">
                {achievements.recentCheckIns.slice(0, 7).map(c => (
                  <div key={c.id} className="recent-checkin">
                    {new Date(c.checkInDate).toLocaleDateString('zh-CN')} - 连续{c.streakCount}天
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="challenges-container">
            {isAdmin && (
              <div className="challenge-actions">
                {showCreateForm ? (
                  <ChallengeCreateForm
                    onSubmit={async (data) => {
                      try {
                        await createChallenge(token!, data);
                        setShowCreateForm(false);
                        await loadChallenges();
                      } catch (err) {
                        setError('Failed to create challenge: ' + (err as Error).message);
                      }
                    }}
                    onCancel={() => setShowCreateForm(false)}
                  />
                ) : (
                  <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                    + 创建挑战活动
                  </button>
                )}
              </div>
            )}

            <div className="challenges-list">
              {challenges.length === 0 ? (
                <p className="empty">暂无挑战活动</p>
              ) : (
                challenges.map(ch => (
                  <div key={ch.id} className="challenge-card">
                    <div className="challenge-header">
                      <h4>{ch.title}</h4>
                      <span className={`challenge-status ${ch.status}`}>
                        {ch.status === 'upcoming' ? '即将开始' : ch.status === 'active' ? '进行中' : ch.status === 'completed' ? '已结束' : '已取消'}
                      </span>
                    </div>
                    {ch.description && <p className="challenge-desc">{ch.description}</p>}
                    <div className="challenge-meta">
                      <span>类型: {ch.type === 'class_pk' ? '班级PK' : ch.type === 'streak_challenge' ? '打卡挑战' : '分数挑战'}</span>
                      <span>参与者: {ch._count?.participants || 0}人</span>
                      <span>开始: {new Date(ch.startTime).toLocaleDateString('zh-CN')}</span>
                      <span>结束: {new Date(ch.endTime).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="challenge-buttons">
                      {isAdmin && ch.status === 'upcoming' && (
                        <button className="btn-small" onClick={() => handleStartChallenge(ch.id)}>启动</button>
                      )}
                      {isAdmin && ch.status === 'active' && (
                        <button className="btn-small" onClick={() => handleEndChallenge(ch.id)}>结束</button>
                      )}
                      {!isAdmin && ch.status === 'active' && (
                        <button className="btn-small" onClick={() => handleJoinChallenge(ch.id)}>参加</button>
                      )}
                      <button className="btn-small" onClick={() => handleChallengeLeaderboard(ch.id)}>查看排行</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedChallengeId && challengeLeaderboard.length > 0 && (
              <div className="challenge-leaderboard">
                <h3>挑战排行榜</h3>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>同学</th>
                      <th>进度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challengeLeaderboard.map((entry, idx) => (
                      <tr key={idx} className={entry.rank <= 3 ? `rank-${entry.rank}` : ''}>
                        <td>{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}</td>
                        <td>{entry.name}</td>
                        <td>{entry.progress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="notifications-container">
            {notifications.length === 0 ? (
              <p className="empty">暂无消息</p>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className={`notification-card ${notif.isRead ? 'read' : 'unread'}`}>
                  <div className="notif-header">
                    <span className="notif-title">{notif.title}</span>
                    <span className="notif-time">{new Date(notif.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="notif-content">{notif.content}</p>
                  {!notif.isRead && (
                    <button className="btn-small" onClick={() => handleMarkNotificationRead(notif.id)}>
                      标记已读
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeCreateForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    title: string;
    description?: string;
    type: string;
    startTime: string;
    endTime: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('class_pk');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  return (
    <div className="challenge-form">
      <h3>创建挑战活动</h3>
      <input
        type="text"
        placeholder="活动标题"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <textarea
        placeholder="活动描述"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="class_pk">班级PK赛</option>
        <option value="streak_challenge">打卡挑战</option>
        <option value="score_challenge">分数挑战</option>
      </select>
      <label>开始时间</label>
      <input
        type="datetime-local"
        value={startTime}
        onChange={e => setStartTime(e.target.value)}
      />
      <label>结束时间</label>
      <input
        type="datetime-local"
        value={endTime}
        onChange={e => setEndTime(e.target.value)}
      />
      <div className="form-buttons">
        <button
          className="btn-primary"
          onClick={() => onSubmit({ title, description, type, startTime, endTime })}
          disabled={!title || !startTime || !endTime}
        >
          创建
        </button>
        <button className="btn-secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
