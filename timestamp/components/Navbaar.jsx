import { NavLink, Link } from 'react-router-dom';

export default function Navbar() {
  const activeClass = "bg-blue-500 text-white px-6 py-3 rounded-lg mx-1";
  const normalClass = "bg-gray-100 text-gray-700 px-6 py-3 rounded-lg mx-1";

  return (
    <div className="flex justify-center mb-8">
      <Link to="/" className={({ isActive }) => isActive ? activeClass : normalClass}>ลงเวลา</Link>
      <Link to="/employees" className={({ isActive }) => isActive ? activeClass : normalClass}>จัดการ</Link>
      <Link to="/dashboard" className={({ isActive }) => isActive ? activeClass : normalClass}>แดชบอร์ด</Link>
      {/* <NavLink to="/summary" className={({ isActive }) => isActive ? activeClass : normalClass}>สรุปรายเดือน</NavLink> */}
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
