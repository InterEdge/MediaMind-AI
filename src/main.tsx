import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './components/AuthGate.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </StrictMode>
);
