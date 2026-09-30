/**
 * 错题打印预览页
 *
 * 从 URL 参数读取 ids，调用 print-export 获取排版数据，
 * 支持"包含答案解析"勾选，调用 window.print() 打印。
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import MathText from '../components/MathText';
import {
  getPrintExportData,
  normalizeImageUrl,
  parseOptions,
  type PrintExportItem,
} from '../services/wrong-questions-api';
import './WrongQuestionBook.css';

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    choice: '选择题',
    fill: '填空题',
    essay: '解答题',
    unknown: '未分类',
  };
  return map[t] || t;
}

export default function WrongQuestionPrint() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();

  const idsParam = searchParams.get('ids') || '';
  const [ids] = useState(() =>
    idsParam
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)
  );

  const [items, setItems] = useState<PrintExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeAnswerAnalysis, setIncludeAnswerAnalysis] = useState(false);

  useEffect(() => {
    if (!token || ids.length === 0) {
      setLoading(false);
      return;
    }
    getPrintExportData(token, ids, includeAnswerAnalysis)
      .then((res) => {
        setItems(res.items || []);
        setLoading(false);
      })
      .catch((e) => {
        showToast('error', e.message || '加载失败');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ids, includeAnswerAnalysis]);

  if (loading) {
    return <div className="wq-loading">加载中...</div>;
  }

  return (
    <div className="wq-print-page">
      <div className="wq-print-toolbar no-print">
        <button className="btn btn-secondary" onClick={() => navigate('/wrong-questions')}>
          返回错题本
        </button>
        <label className="wq-print-checkbox">
          <input
            type="checkbox"
            checked={includeAnswerAnalysis}
            onChange={(e) => setIncludeAnswerAnalysis(e.target.checked)}
          />
          <span>包含答案与解析</span>
        </label>
        <button className="btn btn-primary" onClick={() => window.print()}>
          打印
        </button>
        <span className="wq-print-count">共 {items.length} 题</span>
      </div>

      <div className="wq-print-doc">
        <h1 className="wq-print-title">错题复习卷</h1>
        {items.map((item) => {
          const imgUrl = normalizeImageUrl(item.imageUrl);
          const opts = parseOptions(item.options);
          return (
            <div key={item.id} className="wq-print-item">
              <div className="wq-print-item-header">
                <span className="wq-print-index">{item.index}.</span>
                <span className="wq-print-type">{typeLabel(item.questionType)}</span>
                {item.knowledgePointTags && (
                  <span className="wq-print-tag">标签 {item.knowledgePointTags}</span>
                )}
              </div>
              {imgUrl && (
                <div className="wq-print-image">
                  <img src={imgUrl} alt="错题图片" />
                </div>
              )}
              {item.content && (
                <div className="wq-print-content">
                  <MathText text={item.content} />
                </div>
              )}
              {opts.length > 0 && (
                <div className="wq-print-options">
                  {opts.map((opt, idx) => (
                    <div key={idx} className="wq-print-option">
                      <span className="option-label">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <MathText text={opt} />
                    </div>
                  ))}
                </div>
              )}
              {includeAnswerAnalysis && (
                <div className="wq-print-answers">
                  <div>
                    <strong>我的答案：</strong>
                    {item.myAnswer || '（未填写）'}
                  </div>
                  <div>
                    <strong>正确答案：</strong>
                    {item.correctAnswer || '（未填写）'}
                  </div>
                  {item.analysis && (
                    <div className="wq-print-analysis">
                      <strong>解析：</strong>
                      <MathText text={item.analysis} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="wq-loading">未选择错题</div>
        )}
      </div>
    </div>
  );
}
