import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbaar';
import Checkin from '../pages/Checkin';
import Employees from '../pages/Employees';
import Dashboard from '../pages/Dashboard';
import Summary from '../pages/Summary';
import Login from '../pages/Login';
import { UserProvider, useUser } from '../components/UserContext';
import { useEffect } from 'react';

function DashboardWrapper() {
  const { user } = useUser();
  return <Dashboard user={user} />;
}

// สำหรับผู้ใช้ทั่วไป
function PrivateRoute({ children }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" />;
  return children;
}

// สำหรับ admin
function AdminRoute({ children }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
}

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker error', err));
    }
  }, []);

  return (
    <UserProvider>
      <Router>
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Checkin />} />
            <Route path="/login" element={<Login />} />

            {/* ทุกคนที่ login */}
            <Route path="/dashboard" element={<PrivateRoute><DashboardWrapper /></PrivateRoute>} />

            {/* admin เท่านั้น */}
            <Route path="/employees" element={<AdminRoute><Employees /></AdminRoute>} />
            <Route path="/summary" element={<AdminRoute><Summary /></AdminRoute>} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
