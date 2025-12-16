import { NavLink, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

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
    </div>
  );
}
// เผื่อใช้
// import { NavLink } from 'react-router-dom';
// import { useState, useEffect } from 'react';

// export default function Navbar() {
//   const activeClass = "bg-blue-500 text-white px-6 py-3 rounded-lg mx-1";
//   const normalClass = "bg-gray-100 text-gray-700 px-6 py-3 rounded-lg mx-1";

//   // สมมติว่า role มาจาก backend หรือ localStorage
//   const [role, setRole] = useState('user'); // default = user

//   useEffect(() => {
//     // ในอนาคต fetch role ของผู้ใช้งานจาก backend
//     // ตัวอย่างดึงจาก localStorage
//     const userRole = localStorage.getItem('role') || 'user';
//     setRole(userRole);
//   }, []);

//   return (
//     <div className="flex justify-center mb-8">
   
      
//       {role === 'admin' && (
//         <>
//           <NavLink to="/" className={({ isActive }) => isActive ? activeClass : normalClass}>ลงเวลา</NavLink>
//           <NavLink to="/employees" className={({ isActive }) => isActive ? activeClass : normalClass}>จัดการพนักงาน</NavLink>
//           <NavLink to="/dashboard" className={({ isActive }) => isActive ? activeClass : normalClass}>แดชบอร์ด</NavLink>
//         </>
//       )}
//     </div>
//   );
// }
