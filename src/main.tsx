import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SavedProvider } from './lib';
import App from './App';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SavedProvider>
        <App />
      </SavedProvider>
    </BrowserRouter>
  </StrictMode>,
);
