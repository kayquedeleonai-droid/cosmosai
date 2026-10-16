import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PwaControls from './PwaControls';
import '@xyflow/react/dist/style.css';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /><PwaControls /></React.StrictMode>);
