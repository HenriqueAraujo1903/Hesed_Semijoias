import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FeedbackProvider } from './components/Feedback';
import { initAnalytics } from './services/telemetry';
import './index.css';

// Inicializa Google Analytics se VITE_GA_ID estiver configurado (inerte se não).
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
