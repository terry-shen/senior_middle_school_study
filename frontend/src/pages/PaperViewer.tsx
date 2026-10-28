import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MathText from '../components/MathText';
import { getPaperContent, downloadWholePaperFile, triggerBlobDownload, type PaperContent } from '../services/papers-api';
import './PaperViewer.css';

/** 把 /uploads/xxx 变成后端绝对地址（静态目录无鉴权，可直接给 img/iframe 用） */
function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return `http://localhost:3000${url}`;
  return url;
}

export default function PaperViewer() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [content, setContent] = useState<PaperContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const paperId = parseInt(id || '');

  const load = useCallback(async () => {
    if (!token || isNaN(paperId)) {
      setError('无效的试卷 ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getPaperContent(token, paperId);
      setContent(data);
      setImgIndex(0);
    } catch (e: any) {
      setError(e.message || '加载试卷内容失败');
    } finally {
      setLoading(false);
    }
  }, [token, paperId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async () => {
    if (!token || !content) return;
    setDownloading(true);
    try {
      const ext = content.contentType === 'images' ? 'pdf' : (content.fileUrl?.split('.').pop() || 'pdf');
      const { blob, filename } = await downloadWholePaperFile(token, content.paperId, `${content.title}.${ext}`);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      setError(e.message || '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!content || content.contentType !== 'images') return;
    if (e.key === 'ArrowLeft') {
      setImgIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'ArrowRight') {
      setImgIndex((i) => Math.min(content.pageImages.length - 1, i + 1));
    }
  };

  if (loading) {
    return (
      <div className="paper-viewer">
        <div className="viewer-loading">
          <div className="viewer-spinner" />
          <p className="viewer-loading-text">正在加载试卷内容...</p>
          <p className="viewer-loading-sub">试卷可能较大，请稍候</p>
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="paper-viewer">
        <div className="viewer-loading">
          <p className="viewer-error-icon">⚠️</p>
          <p className="viewer-error-text">{error}</p>
          <div className="viewer-error-actions">
            <button className="btn-sm btn-primary" onClick={load}>重试</button>
            <Link to="/paper-library" className="btn-sm">返回试卷库</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!content) return null;

  const images = content.pageImages || [];
  const metaBits: string[] = [];
  if (content.subject) metaBits.push(`${content.subject.icon || ''} ${content.subject.name}`.trim());
  if (content.year) metaBits.push(`${content.year}年`);
  if (content.region && content.region !== 'Unknown') metaBits.push(content.region);
  if (content.school) metaBits.push(content.school);
  if (content.totalScore) metaBits.push(`满分 ${content.totalScore}`);
  if (content.duration) metaBits.push(`${content.duration} 分钟`);

  return (
    <div className="paper-viewer" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="viewer-header">
        <div className="viewer-header-left">
          <button className="btn-sm" onClick={() => navigate('/paper-library')}>← 返回</button>
          <div className="viewer-title-block">
            <h1 className="viewer-title">{content.title}</h1>
            <div className="viewer-meta">
              {metaBits.map((b, i) => (
                <span key={i} className="viewer-meta-item">{b}</span>
              ))}
              {content.contentType === 'images' && (
                <span className="viewer-meta-item">📷 {images.length} 张照片</span>
              )}
              {content.questionCount > 0 && (
                <span className="viewer-meta-item">📝 {content.questionCount} 道题</span>
              )}
            </div>
          </div>
        </div>
        <div className="viewer-header-actions">
          <button className="btn-sm btn-primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? '下载中...' : '⬇ 下载试卷'}
          </button>
        </div>
      </div>

      {error && <div className="message error viewer-inline-error">{error}</div>}

      <div className="viewer-body">
        {content.contentType === 'images' && images.length > 0 && (
          <>
            <div className="viewer-stage">
              <img
                key={images[imgIndex]}
                className="viewer-image"
                src={toAbsoluteUrl(images[imgIndex])}
                alt={`第 ${imgIndex + 1} 页`}
                onLoad={() => setError('')}
                onError={() => setError(`第 ${imgIndex + 1} 页图片加载失败（原始文件可能已被清理），可尝试下载原始文件查看。`)}
              />
              {images.length > 1 && (
                <>
                  <button
                    className="viewer-nav viewer-nav-prev"
                    onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                    disabled={imgIndex === 0}
                    aria-label="上一页"
                  >
                    ‹
                  </button>
                  <button
                    className="viewer-nav viewer-nav-next"
                    onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                    disabled={imgIndex === images.length - 1}
                    aria-label="下一页"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="viewer-thumbs">
                {images.map((img, i) => (
                  <button
                    key={img}
                    className={`viewer-thumb ${i === imgIndex ? 'active' : ''}`}
                    onClick={() => setImgIndex(i)}
                    title={`第 ${i + 1} 页`}
                  >
                    <img src={toAbsoluteUrl(img)} alt={`缩略图 ${i + 1}`} />
                    <span className="viewer-thumb-index">{i + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="viewer-pager">
              <button className="btn-sm" onClick={() => setImgIndex((i) => Math.max(0, i - 1))} disabled={imgIndex === 0}>
                上一页
              </button>
              <span className="viewer-pager-text">
                第 <b>{imgIndex + 1}</b> / {images.length} 页
              </span>
              <button
                className="btn-sm"
                onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                disabled={imgIndex === images.length - 1}
              >
                下一页
              </button>
            </div>
          </>
        )}

        {content.contentType === 'pdf' && content.fileUrl && (
          <div className="viewer-pdf-wrap">
            <iframe
              className="viewer-pdf"
              src={toAbsoluteUrl(content.fileUrl)}
              title={content.title}
            />
          </div>
        )}

        {content.contentType === 'word' && content.fileUrl && (
          <div className="viewer-empty">
            <p>📄 该试卷为 Word 文档，无法在浏览器内直接预览</p>
            <p className="viewer-loading-sub">
              请下载后使用 Word / WPS 打开查看，或下载后打印作答。
            </p>
            <button className="btn-sm btn-primary" onClick={handleDownload} disabled={downloading}>
              {downloading ? '下载中...' : '⬇ 下载 Word 试卷'}
            </button>
          </div>
        )}

        {content.contentType === 'markdown' && content.markdown && (
          <div className="viewer-markdown">
            <MathText text={content.markdown} />
          </div>
        )}

        {content.contentType === 'none' && (
          <div className="viewer-empty">
            <p>⚠️ 该试卷暂无可查看的内容</p>
            <p className="viewer-loading-sub">可能尚未上传原始文件，或仅包含拆分后的题目（可前往「题目列表」查看）。</p>
          </div>
        )}
      </div>
    </div>
  );
}
