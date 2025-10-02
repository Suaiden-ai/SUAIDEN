import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ProjectStudio from './pages/ProjectStudio';
import { useEffect, useState } from 'react';
import './index.css';

function Router() {
  const [hash, setHash] = useState<string>(location.hash.replace('#', ''));

  useEffect(() => {
    const onHash = () => setHash(location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash.startsWith('/studio')) return <ProjectStudio />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);