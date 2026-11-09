import { useAuth } from '../contexts/AuthContext';
import AiAssistantPanel from '../components/AiAssistantPanel';
import './AiAssistants.css';

export default function AiAssistants() {
  const { user, token } = useAuth();
  if (!token) return null;

  return (
    <div className="ai-page">
      <div className="ai-page-header">
        <h1>🤖 AI 助理</h1>
        <p>选择要使用的在线 AI 助手，点击「打开」在独立窗口进入官网问答。</p>
      </div>
      <AiAssistantPanel token={token} isAdmin={user?.role === 'admin'} showTitle={false} />
    </div>
  );
}
