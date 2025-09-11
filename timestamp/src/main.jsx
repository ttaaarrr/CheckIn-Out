import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Employees from '../pages/Employees.jsx';

const path= createBrowserRouter([
  [
  {
    path: '/login',
    element: <Employees />,
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
