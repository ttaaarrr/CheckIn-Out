import { BrowserRouter } from 'react-router-dom'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_fetcherPersist:true, v7_relativeSplatPath:true }}>
    <App />
    </BrowserRouter>
  </StrictMode>,
)
