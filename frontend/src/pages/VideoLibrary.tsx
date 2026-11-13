import { useAuth } from '../contexts/AuthContext';
import NetdiskBrowser from '../components/NetdiskBrowser';
import './VideoLibrary.css';

export default function VideoLibrary() {
  const { token } = useAuth();

  return (
    <div className="video-library">
      <h1>📺 学习资源</h1>
      <p className="vl-sub">通过下方目录直接浏览网盘资源：点击视频直接播放，点击文档可在线查看或下载。</p>
      {token && <NetdiskBrowser token={token} allSubjects />}
    </div>
  );
}
