import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Building2, User, LogIn, LogOut, Edit, NotebookText, History, ChevronDown, ChevronUp, CheckCircle2, XCircle, X } from 'lucide-react';
import { Link } from "react-router-dom";

export default function Checkin() {
  const [empId, setEmpId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("empId") || "";
    }
    return "";
  });
  const [companyId, setCompanyId] = useState('');
  const [note, setNote] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [records, setRecords] = useState([]);
  const [showOTButtons, setShowOTButtons] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

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

  const typeBadgeColor = {
    in: 'bg-green-100 text-green-700',
    out: 'bg-red-100 text-red-700',
    ot_in_before: 'bg-blue-100 text-blue-700',
    ot_in_after: 'bg-blue-100 text-blue-700',
    ot_out_before: 'bg-yellow-100 text-yellow-700',
    ot_out_after: 'bg-yellow-100 text-yellow-700',
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const fetchCompanies = async () => {
      try {
        const res = await fetch('https://api-checkin-out.bpit-staff.com/api/company/public');
        const data = await res.json();
        if (data.success) {
          setCompanies(data.companies.map(c => ({ id: c.name, name: c.name })));
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchCompanies();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => {
          console.log("GPS ERROR:", error.code);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
    return () => clearInterval(timer);
  }, []);

  const getTimeRecords = async (empCode) => {
  try {
    const month = new Date().toISOString().slice(0, 7); 
    const res = await axios.get(`https://api-checkin-out.bpit-staff.com/api/time-record/monthly`, {
      params: { month, company: companyId }
    });
    if (!res.data.success) return [];
    // filter เฉพาะของพนักงานคนนี้
    return res.data.records.filter(r => String(r.em_code) === String(empCode));
  } catch (err) {
     console.log("getTimeRecords error:", err);
    return [];
  }
};

  const getDeviceId = () => {
    let device_id = localStorage.getItem("device_id");
    if (!device_id) {
      device_id = crypto.randomUUID();
      localStorage.setItem("device_id", device_id);
    }
    return device_id;
  };

  const logTime = async ({ empId, type, company_name, latitude, longitude, note }) => {
    const device_id = getDeviceId();
    try {
      const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/time-record', {
        empId,
        type,
        company_name,
        latitude,
        longitude,
        device_id,
        note,
      });
      return res.data;
    } catch (err) {
      console.error(err);
      return { success: false, message: err.response?.data?.message || 'เกิดข้อผิดพลาด' };
    }
  };

  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Browser ไม่รองรับ GPS'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });

  const checkEmployeeInCompany = async (employeeInput, company_name) => {
    try {
      const res = await axios.get('https://api-checkin-out.bpit-staff.com/api/employees/check', {
        params: { query: employeeInput, company_name }
      });
      return res.data;
    } catch (err) {
      console.error(err);
      return { exists: false };
    }
  };

  const handleCheckin = async (type) => {
    if (loading) return;
    if (!empId || !companyId) {
      setMessage({ text: 'กรุณากรอกข้อมูลพนักงานและเลือกบริษัท', type: 'error' });
      return;
    }

    const { exists, employee } = await checkEmployeeInCompany(empId, companyId);

    if (!exists) {
      setMessage({ text: `ไม่พบข้อมูล ${empId} ในบริษัท ${companyId}`, type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      const res = await logTime({
        empId: employee.em_code,
        type,
        company_name: companyId,
        latitude,
        longitude,
        note: note.trim(),
      });

      if (res.success) {
        setMessage({ text: `${empId} บันทึกเวลา ${typeMapTH[type]} สำเร็จ: ${res.time}`, type: 'success' });
        setNote('');
        const newRecords = await getTimeRecords(employee.em_code);
        setRecords(newRecords);
        setShowHistory(true);
        if (type.startsWith('ot')) setShowOTButtons(false);
      } else {
        setMessage({ text: res.message, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'กรุณาเปิด GPS ก่อนลงเวลา', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!empId || !companyId) {
      setMessage({ text: 'กรุณากรอกรหัสพนักงานและเลือกบริษัทก่อน', type: 'error' });
      return;
    }
    if (showHistory) {
      setShowHistory(false);
      return;
    }

    setHistoryLoading(true);
    const { exists, employee } = await checkEmployeeInCompany(empId, companyId);
    console.log("exists:", exists, "employee:", employee);
    if (exists) {
      const recs = await getTimeRecords(employee.em_code);
      setRecords(recs);
      console.log("rec.date raw:", recs.map(r => r.date));
      console.log("sliced dates:", recs.map(r => r.date.slice(0, 10)));
      setShowHistory(true);
    } else {
      setMessage({ text: `ไม่พบข้อมูล ${empId} ในบริษัท ${companyId}`, type: 'error' });
    }
    setHistoryLoading(false);
  };

  // Group records by date for display
 const groupedRecords = records.reduce((acc, rec) => {
  const localDate = new Date(new Date(rec.date).getTime() + 7 * 60 * 60 * 1000);
  const rawDate = rec.date.slice(0, 10);
  const [y, m, d] = rawDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateStr = dateObj.toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
  if (!acc[dateStr]) acc[dateStr] = [];
  acc[dateStr].push(rec);
  return acc;
}, {});

  return (
    <div className="min-h-screen flex flex-col items-center relative p-4">

      {/* กล่องหลัก */}
      <div className="relative w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 mt-6 border border-gray-100">

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-blue-800 text-4xl font-extrabold">
          <h1 className="leading-tight text-center">BPIT Time App</h1>
        </div>

        {/* วันที่ + เวลา */}
        <div className="text-center mb-6">
          <h4 className="text-xl font-extrabold text-blue-700">
            บันทึกเวลาเข้า-ออกงาน
          </h4>
          <p className="font-semibold text-gray-600 mt-2 text-lg">
            {currentTime.toLocaleDateString("th-TH", {
              weekday: "short", day: "numeric", month: "short", year: "numeric",
            })}
          </p>
          <p className="flex items-center justify-center gap-2 font-bold text-gray-600 text-lg mt-1">
            <Clock className="w-5 h-5 text-blue-500" />
            {currentTime.toLocaleTimeString("th-TH", {
              hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
            })}
          </p>
        </div>

        {/* Input รหัสพนักงาน */}
        <div className="relative mb-4">
          <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={empId}
            onChange={(e) => {
              const value = e.target.value;
              setEmpId(value);
              if (value.trim() !== "") localStorage.setItem("empId", value);
            }}
            placeholder="รหัสพนักงานหรือชื่อพนักงาน"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 text-base"
          />
        </div>

        {/* เลือกบริษัท */}
        <div className="relative mb-4">
          <Building2 className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 text-base"
          >
            <option value="">เลือกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* หมายเหตุ — เชื่อมกับ state */}
        <div className="relative mb-6">
          <NotebookText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ถ้ามี)"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 text-base"
          />
        </div>

        {/* ปุ่มลงเวลา */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {["in", "out"].map((type) => (
            <button
              key={type}
              disabled={loading}
              onClick={() => handleCheckin(type)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl 
                text-white font-semibold shadow-md text-base
                ${typeColor[type]}
                ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {type === "in" && <LogIn className="w-5 h-5" />}
              {type === "out" && <LogOut className="w-5 h-5" />}
              {typeMapTH[type]}
            </button>
          ))}
        </div>

        {/* ปุ่ม OT */}
        <button
          disabled={loading}
          onClick={() => setShowOTButtons(prev => !prev)}
          className={`flex items-center justify-center gap-2 w-full py-3 mb-4 
            rounded-xl bg-purple-500 text-white font-semibold shadow-md
            ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <Edit className="w-5 h-5" /> OT
        </button>

        {/* ปุ่ม OT 4 แบบ */}
        {showOTButtons && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {["ot_in_before", "ot_in_after", "ot_out_before", "ot_out_after"].map((type) => (
              <button
                key={type}
                disabled={loading}
                onClick={() => handleCheckin(type)}
                className={`py-3 rounded text-white text-base
                  ${typeColor[type]}
                  ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {typeMapTH[type]}
              </button>
            ))}
          </div>
        )}

        {/* ปุ่มดูประวัติ */}
        <button
          disabled={historyLoading}
          onClick={handleLoadHistory}
          className={`flex items-center justify-center gap-2 w-full py-3 mb-4
            rounded-xl border-2 border-blue-500 text-blue-600 font-semibold
            hover:bg-blue-50 transition-colors
            ${historyLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {historyLoading
            ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <History className="w-5 h-5" />
          }
          ประวัติการเข้าออกงาน
          {showHistory ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>

        {/* ตารางประวัติ */}
        {showHistory && (
          <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
            {records.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                ไม่พบประวัติการลงเวลา
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {Object.entries(groupedRecords).map(([dateLabel, dayRecs]) => (
                  <div key={dateLabel}>
                    {/* วันที่ header */}
                    <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide sticky top-0">
                      {dateLabel}
                    </div>
                    {dayRecs.map((rec, i) => {
                     const localDate = new Date(new Date(rec.date).getTime() + 7 * 60 * 60 * 1000);
                      const rawDate = localDate.toISOString().slice(0, 10);
                      const [ry, rm, rd] = rawDate.split('-').map(Number);
                      const [hh, mm] = rec.time.split(':').map(Number);
                      const timeStr = new Date(ry, rm - 1, rd, hh, mm)
                       .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                      return (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          {/* เวลา */}
                          <div className="flex flex-col items-center min-w-[48px]">
                            <span className="text-sm font-bold text-gray-700">{timeStr}</span>
                          </div>
                          {/* ประเภท + หมายเหตุ */}
                          <div className="flex flex-col gap-1 flex-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${typeBadgeColor[rec.type] || 'bg-gray-100 text-gray-600'}`}>
                              {typeMapTH[rec.type] || rec.type}
                            </span>
                            {rec.note && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <NotebookText className="w-3 h-3 text-gray-400" />
                                {rec.note}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


      </div>

      {/* ปุ่มลอยมุมขวา */}
      <div className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-none">
        <button
          onClick={() => setOpen(!open)}
          className="pointer-events-auto bg-blue-600/80 hover:bg-blue-600 text-white text-sm sm:text-base px-4 py-2 sm:px-5 sm:py-3
            rounded-full shadow-md opacity-80 hover:opacity-100">
          สำหรับเจ้าหน้าที่
        </button>

        {open && (
          <div className="absolute bottom-12 right-0 w-48 bg-white rounded-xl shadow-xl border pointer-events-auto">
            <Link
              to="/employees"
              className="block w-full text-center py-2 text-sm hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              จัดการพนักงาน
            </Link>
            <Link
              to="/dashboard"
              className="block w-full text-center py-2 text-sm hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              ตารางการลงเวลา
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="block w-full text-center py-2 text-sm bg-gray-100 hover:bg-gray-200"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>

      {/* Modal popup กลางหน้าจอ */}
      {message && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setMessage(null)}
        >
          <div
            className={`relative w-full max-w-sm rounded-3xl shadow-2xl px-8 py-10
              flex flex-col items-center gap-5 bg-white
              animate-[popIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)_both]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ไอคอนวงกลมใหญ่ */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center
              ${message.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {message.type === 'success'
                ? <CheckCircle2 className="w-14 h-14 text-green-500" strokeWidth={1.5} />
                : <XCircle className="w-14 h-14 text-red-500" strokeWidth={1.5} />
              }
            </div>

            {/* หัวข้อ */}
            <p className={`text-2xl font-extrabold text-center
              ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {message.type === 'success' ? 'บันทึกสำเร็จ!' : 'เกิดข้อผิดพลาด'}
            </p>

            {/* ข้อความ */}
            <p className="text-base text-gray-600 text-center leading-relaxed">
              {message.text}
            </p>

            {/* ปุ่มปิด */}
            <button
              onClick={() => setMessage(null)}
              className={`mt-2 w-full py-3 rounded-2xl text-white font-bold text-lg shadow
                ${message.type === 'success'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
                } transition-colors`}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-gradient-to-b from-black/40 to-black/60 backdrop-blur-md">
          <div className="relative bg-white rounded-[28px] px-10 py-9
                          shadow-[0_20px_50px_rgba(0,0,0,0.25)]
                          flex flex-col items-center gap-5 animate-premiumIn">
            <div className="relative w-16 h-16">
              <span className="absolute inset-0 rounded-full border-[3px] border-blue-100" />
              <span className="absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-blue-900 font-bold text-lg tracking-wide">กำลังบันทึกเวลา</p>
            <p className="text-gray-500 text-sm">ระบบกำลังประมวลผลข้อมูล</p>
          </div>
        </div>
      )}
    </div>
  );
}
