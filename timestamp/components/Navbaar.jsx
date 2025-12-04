import { NavLink,useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  // ❌ ถ้าอยู่หน้าลงเวลา "/" ให้ไม่แสดง Navbar
  if (location.pathname === "/") return null;
  const activeClass = "bg-blue-500 text-white px-6 py-3 rounded-lg mx-1";
  const normalClass = "bg-gray-100 text-gray-700 px-6 py-3 rounded-lg mx-1";

  return (
    <div className="flex justify-center mb-8">
      <NavLink to="/" className={({ isActive }) => isActive ? activeClass : normalClass}>บันทึกเวลา</NavLink>
      <NavLink to="/employees" className={({ isActive }) => isActive ? activeClass : normalClass}>จัดการ</NavLink>
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? activeClass : normalClass}>ตารางการลงเวลา</NavLink>
      {/* <NavLink to="/summary" className={({ isActive }) => isActive ? activeClass : normalClass}>สรุปรายเดือน</NavLink> */}
    </div>
  );
}
