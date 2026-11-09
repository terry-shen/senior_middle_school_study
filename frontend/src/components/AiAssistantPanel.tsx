import { useEffect, useMemo, useState } from 'react';
import { listAiAssistants, updateAiAssistant, type AiAssistant } from '../services/ai-assistants-api';
import './AiAssistantPanel.css';

interface Props {
  token: string;
  isAdmin: boolean;
  showTitle?: boolean;
}

export default function AiAssistantPanel({ token, isAdmin, showTitle = true }: Props) {
  const [items, setItems] = useState<AiAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listAiAssistants(token);
        if (alive) setItems(res.data || []);
      } catch (e: any) {
        if (alive) setMsg(e?.message || '加载 AI 助理失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const handleOpen = (a: AiAssistant) => {
    if (!a.url) {
      setMsg(isAdmin ? '该站点尚未配置网址，请在卡片下方填写后保存' : '该站点尚未配置网址，请联系管理员');
      return;
    }
    setMsg('');
    window.open(a.url, `ai_${a.code}`, 'noopener,noreferrer');
  };

  const handleSaveUrl = async (a: AiAssistant) => {
    const url = (urlDrafts[a.code] ?? a.url).trim();
    setSavingId(a.id);
    setMsg('');
    try {
      await updateAiAssistant(token, a.id, { url });
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, url } : x)));
      setMsg(`已保存 ${a.name} 的访问地址`);
    } catch (e: any) {
      setMsg(e?.message || '保存网址失败');
    } finally {
      setSavingId(0);
    }
  };

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order || a.id - b.id), [items]);

  return (
    <section className="ai-panel">
      {showTitle && <h3 className="wb-block-title">🤖 AI 助理</h3>}
      <p className="ai-hint">
        点击「打开」在独立窗口进入官网。各站点需用其自身的账号体系登录，本站只提供介绍与入口，不记录任何账号信息。
      </p>
      {msg && <div className="ai-msg">{msg}</div>}
      {loading ? (
        <div className="ai-empty">加载中...</div>
      ) : sorted.length === 0 ? (
        <div className="ai-empty">暂未配置 AI 助理站点。</div>
      ) : (
        <div className="ai-grid">
          {sorted.map((a) => (
            <div key={a.code} className="ai-card">
              <div className="ai-card-head">
                <span className="ai-icon">{a.icon || '🤖'}</span>
                <div className="ai-title-wrap">
                  <div className="ai-name">{a.name}</div>
                  {a.description && <div className="ai-desc">{a.description}</div>}
                </div>
              </div>

              <div className="ai-foot">
                <span className="ai-url">{a.url || '未配置网址'}</span>
                <button className="ai-btn ai-btn-primary" onClick={() => handleOpen(a)}>
                  打开 →
                </button>
              </div>

              {isAdmin && (
                <div className="ai-admin">
                  <input
                    className="ai-input ai-input-url"
                    placeholder="https://...（管理员可修改网址）"
                    value={urlDrafts[a.code] ?? a.url}
                    onChange={(e) => setUrlDrafts((prev) => ({ ...prev, [a.code]: e.target.value }))}
                  />
                  <button
                    className="ai-btn ai-btn-ghost"
                    onClick={() => handleSaveUrl(a)}
                    disabled={savingId === a.id}
                  >
                    {savingId === a.id ? '保存中...' : '保存网址'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
