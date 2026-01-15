
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; // Import the main App component
import './index.css'; // Import Styles

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
