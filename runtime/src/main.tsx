/** 游戏运行时入口
 * 说明：刻意不使用 React.StrictMode —— 剧情推进属于"必须只执行一次"的副作用，
 * 双渲染会让打字机与节点推进出现重复执行。 */
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
