import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Preview } from './Preview';
import './styles.css';

const previewId = new URLSearchParams(window.location.search).get('preview');

createRoot(document.getElementById('root')!).render(
    <StrictMode>{previewId !== null ? <Preview id={previewId} /> : <App />}</StrictMode>,
);
