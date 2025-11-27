import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Building2, User, LogIn, LogOut, Edit } from 'lucide-react';
export default function Checkin() {
  const [empId, setEmpId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [records, setRecords] = useState([]);
  const [showOTButtons, setShowOTButtons] = useState(false);
  const typeMapTH = { 
    in: 'เข้างาน', 
    out: 'ออกงาน', 
    ot_in_before: 'เข้า OT ก่อนเข้างาน',
    ot_in_after: 'เข้า OT หลังเลิกงาน',
    ot_out_before: 'ออก OT ก่อนเข้างาน',
    ot_out_after: 'ออก OT หลังเลิกงาน'
  };
  const typeColor = {
    in: 'bg-green-500 hover:bg-green-600',
    out: 'bg-red-500 hover:bg-red-600',
    ot_in_before: 'bg-blue-500 hover:bg-blue-600',
    ot_in_after: 'bg-blue-500 hover:bg-blue-600',
    ot_out_before: 'bg-yellow-500 hover:bg-yellow-600',
    ot_out_after: 'bg-yellow-500 hover:bg-yellow-600',
  };
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const fetchCompanies = async () => {
      try {
        const res = await fetch('https://api-checkin-out.bpit-staff.com/api/company');
        const data = await res.json();
        if (data.success) {
          setCompanies(data.companies.map(c => ({ id: c.name, name: c.name })));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCompanies();
    return () => clearInterval(timer);
  }, []);
  const getTimeRecords = async (empId) => {
    try {
      const res = await axios.get(`https://api-checkin-out.bpit-staff.com/api/time-record/${empId}`);
      return res.data.success ? res.data.records : [];
    } catch {
      return [];
    }
  };
  const logTime = async ({ empId, type, company_name, latitude, longitude }) => {
    try {
      const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/time-record', {
        empId,
        type,
        company_name,
        latitude,
        longitude,
      });
      return res.data;
    } catch (err) {
      console.error(err);
      return { success: false, message: err.response?.data?.message || 'เกิดข้อผิดพลาด' };
    }
  };
  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Browser ไม่รองรับ GPS'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
    });

  const handleCheckin = async (type) => {
    if (!empId || !companyId) {
      setMessage({ text: 'กรุณากรอกข้อมูลพนักงานและเลือกบริษัท', type: 'error' });
      return;
    }

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      // log เวลาไป backend
      const res = await logTime({ empId, type, company_name: companyId, latitude, longitude });

      if (res.success) {
        setMessage({ text: `บันทึกเวลา ${typeMapTH[type]} สำเร็จ: ${res.time}`, type: 'success' });
        setEmpId('');
        setRecords(await getTimeRecords(empId));

        if (type.startsWith('ot')) {
          setShowOTButtons(false); 
        }
      } else {
        setMessage({ text: res.message, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'กรุณาเปิด GPS ก่อนลงเวลา', type: 'error' });
    }
  };

  return (
   <div className="max-w-lg w-full mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-8 mt-10 border border-gray-100">
  <div className="mb-6 sm:mb-10 flex flex-col items-center justify-center text-blue-800 text-4xl sm:text-5xl font-extrabold">
    <h1>BPIT Time App</h1>
  </div>
  <div className="text-center mb-4 sm:mb-6">
    <h4 className="text-xl sm:text-2xl font-extrabold text-blue-700">บันทึกเวลาเข้า-ออกงาน</h4>
    <p className="flex items-center justify-center gap-2 text-gray-600 mt-1 sm:mt-2 text-base sm:text-lg">
      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
      {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
    </p>
  </div>
  {/* Input พนักงาน */}
  <div className="relative mb-3 sm:mb-4">
    <User className="absolute left-3 top-3 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
    <input
      type="text"
      value={empId}
      onChange={(e) => setEmpId(e.target.value)}
      placeholder="รหัสพนักงานหรือชื่อพนักงาน"
      className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm sm:text-base"
    />
  </div>
  {/* Select บริษัท */}
  <div className="relative mb-4 sm:mb-6">
    <Building2 className="absolute left-3 top-3 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
    <select
      value={companyId}
      onChange={(e) => setCompanyId(e.target.value)}
      className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm sm:text-base"
    >
      <option value="">เลือกบริษัท</option>
      {companies.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
  </div>
  {/* ปุ่มลงเวลา */}
  <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
    {['in', 'out'].map((type) => (
      <button
        key={type}
        onClick={() => handleCheckin(type)}
        className={`flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-white font-semibold shadow-md transition text-sm sm:text-base ${typeColor[type]}`}
      >
        {type === 'in' && <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />}
        {type === 'out' && <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />}
        {typeMapTH[type]}
      </button>
    ))}
  </div>
  {/* ปุ่มขอ OT */}
  <button
    onClick={() => setShowOTButtons(true)}
    className="flex items-center justify-center gap-2 w-full py-2 sm:py-3 mb-4 sm:mb-6 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-md text-sm sm:text-base"
  >
    <Edit className="w-4 h-4 sm:w-5 sm:h-5" /> OT
  </button>
  {/* ปุ่ม OT 4 ปุ่ม */}
  {showOTButtons && (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
      {['ot_in_before', 'ot_in_after', 'ot_out_before', 'ot_out_after'].map((type) => (
        <button
          key={type}
          className={`text-white py-2 px-2 sm:px-4 rounded text-sm sm:text-base ${typeColor[type]} hover:opacity-90`}
          onClick={() => handleCheckin(type)}
        >
          {typeMapTH[type]}
        </button>
      ))}
    </div>
  )}
  {/* ข้อความสถานะ */}
  {message && (
    <div className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg text-center font-medium text-sm sm:text-base ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {message.text}
    </div>
  )}
  {/* ประวัติ */}
  {records.length > 0 && (
    <div className="mt-4 sm:mt-8">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2 sm:mb-3">ประวัติเวลาพนักงาน</h3>
      <ul className="max-h-48 sm:max-h-60 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50 text-sm sm:text-base">
        {records.map((r) => (
          <li key={r.id} className="px-3 py-2">
            {new Date(r.date).toLocaleDateString('th-TH')} {r.time}{' '}
            <span className="font-semibold text-blue-600">[{typeMapTH[r.type] || r.type}]</span>
          </li>
        ))}
      </ul>
    </div>
  )}
</div>
  );
}
