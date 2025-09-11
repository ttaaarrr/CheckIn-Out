import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

const path= createBrowserRouter([
  [
  {
    path: '/login',
    element: <Checkin />,
  },
]
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={path}>
    <App />
    </RouterProvider>
  </StrictMode>,
)
