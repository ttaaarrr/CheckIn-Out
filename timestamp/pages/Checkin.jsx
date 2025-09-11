import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Checkin() {
  const [empId, setEmpId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [companies, setCompanies] = useState([]); 
  const [records, setRecords] = useState([]);

  const typeMapTH = { in:'เข้างาน', out:'ออกงาน', ot_in:'เข้า OT', ot_out:'ออก OT' };

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
      const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/time-record', { empId, type, company_name, latitude, longitude });
      return res.data;
    } catch (err) {
      console.error(err);
      return { success: false, message: err.response?.data?.message || 'เกิดข้อผิดพลาด' };
    }
  };

  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Browser ไม่รองรับ GPS"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
    });

  const handleCheckin = async (type) => {
    if (!empId) return alert("กรุณาใส่รหัสหรือชื่อพนักงาน");
    if (!companyId) return alert("กรุณาเลือกบริษัท");

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      // ดึงพนักงานของบริษัทนี้
      const resEmp = await fetch(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${companyId}`);
      const data = await resEmp.json();

      // หา match จาก "รหัส" หรือ "ชื่อ"
      const matchedEmp = data.success 
        ? data.employees.find(e => 
            e.em_code.toString() === empId.trim() || 
            e.name.trim() === empId.trim()
          )
        : null;

      if (!matchedEmp) {
        return alert("ไม่พบรหัสหรือชื่อพนักงานนี้ในบริษัทที่เลือก");
      }

      const today = new Date().toLocaleDateString('sv-SE'); 
      const empRecords = await getTimeRecords(matchedEmp.em_code);

      if (empRecords.some(r => r.date === today && r.type === type)) {
        return alert(`คุณได้บันทึก "${typeMapTH[type]}" ไปแล้วในวันนี้`);
      }

      const res = await logTime({ 
        empId: matchedEmp.em_code, // ส่งด้วยรหัสจริง
        type, 
        company_name: companyId, 
        latitude, 
        longitude 
      });

      if (res.success) {
        setMessage({ text: `บันทึกเวลา ${typeMapTH[type]} สำเร็จ: ${res.time}`, type: 'success' });
        setEmpId('');
        setRecords(await getTimeRecords(matchedEmp.em_code));
      } else {
        setMessage({ text: res.message, type: 'error' });
      }

    } catch (err) {
      console.error(err);
      alert(err.message || "กรุณาอนุญาต GPS ก่อนลงเวลา");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mt-10">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ลงเวลาเข้า-ออกงาน</h2>
        <p className="text-gray-600 mt-2">{currentTime.toLocaleTimeString('th-TH')}</p>
      </div>

      {/* 🔹 ช่องนี้กรอกได้ทั้ง "ชื่อ" หรือ "รหัส" */}
      <input
        type="text"
        value={empId}
        onChange={e => setEmpId(e.target.value)}
        placeholder="รหัสพนักงานหรือชื่อพนักงาน"
        className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4"
      />

      <select
        value={companyId}
        onChange={e => setCompanyId(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4"
      >
        <option value="">เลือกบริษัท</option>
        {companies.map(c => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      <div className="flex gap-2 flex-wrap mb-4">
        {['in','out','ot_in','ot_out'].map(type => (
          <button
            key={type}
            onClick={() => handleCheckin(type)}
            className="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-medium"
          >
            {typeMapTH[type]}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-lg ${message.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">ประวัติเวลาพนักงาน</h3>
          <ul className="max-h-60 overflow-auto border border-gray-200 rounded-lg p-2">
            {records.map(r => (
              <li key={r.id} className="border-b border-gray-100 py-1">
                {new Date(r.date).toLocaleDateString('th-TH')} {r.time} [{typeMapTH[r.type] || r.type}]
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
