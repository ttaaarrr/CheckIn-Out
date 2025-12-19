import { useUser } from './UserContext';
import { NavLink, useLocation, Link } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const { user } = useUser();
  // ❌ ถ้าอยู่หน้าลงเวลา "/" ให้ไม่แสดง Navbar
  if (location.pathname === "/") return null;

  const activeClass =
    "bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm";
  const normalClass =
    "bg-gray-100 text-gray-700 px-4 py-2 rounded-lg";

  return (
    <div className="w-full flex flex-wrap justify-center gap-2 py-3 px-2 sticky top-0 bg-white z-40 shadow-sm">
      <NavLink
        to="/"
        className={({ isActive }) => isActive ? activeClass : normalClass}
      >
        บันทึกเวลา
      </NavLink>

      <NavLink
        to="/employees"
        className={({ isActive }) => isActive ? activeClass : normalClass}
      >
        จัดการ
      </NavLink>

      <NavLink
        to="/dashboard"
        className={({ isActive }) => isActive ? activeClass : normalClass}
      >
        ตารางการลงเวลา
      </NavLink>
       {user?.role === 'admin' && (
      <NavLink
         to="/addmanager"
         className={({ isActive }) => isActive ? activeClass : normalClass}
          >
            เพิ่มผู้จัดการ
      </NavLink>
      )}
    </div>
  );
}
