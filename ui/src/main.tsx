/**
 * 學習筆記：React 的 createRoot 把元件樹掛到 #root。
 * 這裡只負責啟動畫面；規則全在 core，UI 不重算傷害。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('缺少 #root');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
