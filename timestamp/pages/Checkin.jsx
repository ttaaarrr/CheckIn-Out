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

  // Modal OT ล่วงหน้า
  const [showOTModal, setShowOTModal] = useState(false);
  const [otDate, setOtDate] = useState('');
  const [otStartHour, setOtStartHour] = useState('08');
  const [otStartMinute, setOtStartMinute] = useState('00');
  const [otEndHour, setOtEndHour] = useState('17');
  const [otEndMinute, setOtEndMinute] = useState('00');
  const [otReason, setOtReason] = useState('');

  const typeMapTH = { in: 'เข้างาน', out: 'ออกงาน', ot_in: 'เข้า OT', ot_out: 'ออก OT' };
  const typeColor = {
    in: 'bg-green-500 hover:bg-green-600',
    out: 'bg-red-500 hover:bg-red-600',
    ot_in: 'bg-indigo-500 hover:bg-indigo-600',
    ot_out: 'bg-yellow-500 hover:bg-yellow-600',
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
    if (!empId) return alert('กรุณาใส่รหัสหรือชื่อพนักงาน');
    if (!companyId) return alert('กรุณาเลือกบริษัท');

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      const resEmp = await fetch(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${companyId}`);
      const data = await resEmp.json();

      const matchedEmp = data.success
        ? data.employees.find(
            (e) => e.em_code.toString() === empId.trim() || e.name.trim() === empId.trim()
          )
        : null;

      if (!matchedEmp) {
        return alert('ไม่พบรหัสหรือชื่อพนักงานนี้ในบริษัทที่เลือก');
      }

      const today = new Date().toLocaleDateString('sv-SE');
      const empRecords = await getTimeRecords(matchedEmp.em_code);

      if (empRecords.some((r) => r.date === today && r.type === type)) {
        return alert(`คุณได้บันทึก "${typeMapTH[type]}" ไปแล้วในวันนี้`);
      }

      const res = await logTime({
        empId: matchedEmp.em_code,
        type,
        company_name: companyId,
        latitude,
        longitude,
      });

      if (res.success) {
        setMessage({
          text: `บันทึกเวลา ${typeMapTH[type]} สำเร็จ: ${res.time}`,
          type: 'success',
        });
        setEmpId('');
        setRecords(await getTimeRecords(matchedEmp.em_code));
      } else {
        setMessage({ text: res.message, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'กรุณาอนุญาต GPS ก่อนลงเวลา');
    }
  };

  // ส่งคำขอ OT ล่วงหน้า
  const handleSubmitOTRequest = async () => {
    if (!empId || !companyId || !otDate || !otStartHour || !otStartMinute || !otEndHour || !otEndMinute || !otReason)
      return alert('กรุณากรอกข้อมูลให้ครบ');

    try {
      const resEmp = await fetch(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${companyId}`);
      const data = await resEmp.json();
      const matchedEmp = data.success
        ? data.employees.find(
            (e) => e.em_code.toString() === empId.trim() || e.name.trim() === empId.trim()
          )
        : null;
      if (!matchedEmp) return alert('ไม่พบพนักงาน');

      const otStart = `${otStartHour}:${otStartMinute}`;
      const otEnd = `${otEndHour}:${otEndMinute}`;

      const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/ot-request', {
        empId: matchedEmp.em_code,
        company_name: companyId,
        date: otDate,
        start_time: otStart,
        end_time: otEnd,
        reason: otReason,
      });

      if (res.data.success) {
        setMessage({ text: 'ส่งคำขอ OT ล่วงหน้าสำเร็จ', type: 'success' });
        setShowOTModal(false);
        setOtDate(''); setOtStartHour('08'); setOtStartMinute('00'); setOtEndHour('17'); setOtEndMinute('00'); setOtReason('');
      } else {
        setMessage({ text: res.data.message || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: err.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl p-8 mt-10 border border-gray-100">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="mx-auto w-14 h-14 flex items-center justify-center text-white text-2xl font-bold">
          <img src="/src/assets/logo.png" alt="BPIT Logo" className="w-32 h-16" />
        </div>
        <h2 className="text-3xl font-extrabold text-blue-700">ลงเวลาเข้า-ออกงาน</h2>
        <p className="flex items-center justify-center gap-2 text-gray-600 mt-2 text-lg">
          <Clock className="w-5 h-5 text-blue-500" />
          {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Input พนักงาน */}
      <div className="relative mb-4">
        <User className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          placeholder="รหัสพนักงานหรือชื่อพนักงาน"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {/* Select บริษัท */}
      <div className="relative mb-6">
        <Building2 className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="">เลือกบริษัท</option>
          {companies.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ปุ่มลงเวลา */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {['in', 'out', 'ot_in', 'ot_out'].map((type) => (
          <button
            key={type}
            onClick={() => handleCheckin(type)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold shadow-md transition ${typeColor[type]}`}
          >
            {type === 'in' && <LogIn className="w-5 h-5" />}
            {type === 'out' && <LogOut className="w-5 h-5" />}
            {typeMapTH[type]}
          </button>
        ))}
      </div>

      {/* ปุ่มขอ OT ล่วงหน้า */}
      <button
        onClick={() => setShowOTModal(true)}
        className="flex items-center justify-center gap-2 w-full py-3 mb-6 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-md"
      >
        <Edit className="w-5 h-5" /> ขอ OT ล่วงหน้า
      </button>

      {/* ข้อความสถานะ */}
      {message && (
        <div className={`mt-4 p-4 rounded-lg text-center font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* ประวัติ */}
      {records.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-800 mb-3">ประวัติเวลาพนักงาน</h3>
          <ul className="max-h-60 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50">
            {records.map((r) => (
              <li key={r.id} className="px-3 py-2 text-sm text-gray-700">
                {new Date(r.date).toLocaleDateString('th-TH')} {r.time}{' '}
                <span className="font-semibold text-blue-600">[{typeMapTH[r.type] || r.type}]</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal ขอ OT ล่วงหน้า */}
      {showOTModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 relative">
            <h3 className="text-xl font-bold mb-4">ขอ OT ล่วงหน้า</h3>
            
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium">วันที่</label>
              <input type="date" value={otDate} onChange={e => setOtDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>

           <div className="mb-3 grid grid-cols-2 gap-2">
  <div>
    <label className="block mb-1 text-sm font-medium">เวลาเริ่ม</label>
    <div className="flex gap-2">
      <select
        value={otStartHour}
        onChange={(e) => setOtStartHour(e.target.value)}
        className="w-1/2 border border-gray-300 rounded-lg px-2 py-2"
      >
        {[...Array(24)].map((_, h) => (
          <option key={h} value={h.toString().padStart(2, '0')}>
            {h.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        value={otStartMinute}
        onChange={(e) => setOtStartMinute(e.target.value)}
        className="w-1/2 border border-gray-300 rounded-lg px-2 py-2"
      >
        {[...Array(60)].map((_, m) => (
          <option key={m} value={m.toString().padStart(2, '0')}>
            {m.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  </div>

  <div>
    <label className="block mb-1 text-sm font-medium">เวลาสิ้นสุด</label>
    <div className="flex gap-2">
      <select
        value={otEndHour}
        onChange={(e) => setOtEndHour(e.target.value)}
        className="w-1/2 border border-gray-300 rounded-lg px-2 py-2"
      >
        {[...Array(24)].map((_, h) => (
          <option key={h} value={h.toString().padStart(2, '0')}>
            {h.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        value={otEndMinute}
        onChange={(e) => setOtEndMinute(e.target.value)}
        className="w-1/2 border border-gray-300 rounded-lg px-2 py-2"
      >
        {[...Array(60)].map((_, m) => (
          <option key={m} value={m.toString().padStart(2, '0')}>
            {m.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  </div>
</div>


            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium">เหตุผล</label>
              <textarea value={otReason} onChange={e => setOtReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowOTModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">ยกเลิก</button>
              <button onClick={handleSubmitOTRequest} className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white">ส่งคำขอ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
