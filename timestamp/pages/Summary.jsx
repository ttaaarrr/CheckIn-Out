import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../components/UserContext';
import axios from 'axios';

export default function Summary() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedEmp, setSelectedEmp] = useState(null); // เพิ่ม state สำหรับพนักงานที่คลิกดูรายละเอียด

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const compRes = await axios.get('/api/company');
        if (compRes.data.success) {
          setCompanies(compRes.data.companies.map(c => ({ id: c.company_id, name: c.company_id })));
        }

        const recRes = await axios.get(`/api/time-record`, { params: { year, month } });
        if (recRes.data.success) setRecords(recRes.data.records);
      } catch (err) {
        console.error('API error:', err);
      }
    };

    fetchData();
  }, [user, year, month]);

  // --- ประมวลผลสรุป ---
  const summaryData = {};
  const parseTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const [h, m, s] = timeStr.split(':').map(Number);
    const d = new Date(dateStr);
    d.setHours(h, m, s, 0);
    return d;
  };

  records.forEach(r => {
  if (selectedCompany !== 'all' && r.company_name !== selectedCompany) return;

  const recordDate = new Date(r.date + 'T' + r.time + ':00'); // รวม date+time
if (recordDate.getFullYear() !== year || (recordDate.getMonth()+1) !== month) return;
    const key = r.empId;
    if (!summaryData[key]) {
      summaryData[key] = {
        empId: r.empId,
        name: r.name,
        workDays: new Set(),
        totalWorkMs: 0,
        totalOTMs: 0,
        lastCheckIn: null,
        lastOTIn: null,
        dailyRecords: {} // เก็บรายละเอียดรายวัน
      };
    }

    const emp = summaryData[key];
    emp.workDays.add(r.date);

    if (!emp.dailyRecords[r.date]) {
      emp.dailyRecords[r.date] = {
        checkIn: null,
        checkOut: null,
        otIn: null,
        otOut: null
      };
    }
    const day = emp.dailyRecords[r.date];

    if (r.type === 'เข้างาน') {
      const time = parseTime(r.date, r.time);
      emp.lastCheckIn = time;
      day.checkIn = time;
    }
    if (r.type === 'ออกงาน' && emp.lastCheckIn) {
      const time = parseTime(r.date, r.time);
      if (time && time > emp.lastCheckIn) {
        emp.totalWorkMs += time - emp.lastCheckIn;
        day.checkOut = time;
      }
      emp.lastCheckIn = null;
    }

    if (r.type === 'เข้า OT') {
      const time = parseTime(r.date, r.time);
      emp.lastOTIn = time;
      day.otIn = time;
    }
    if (r.type === 'ออก OT' && emp.lastOTIn) {
      const time = parseTime(r.date, r.time);
      if (time && time > emp.lastOTIn) {
        emp.totalOTMs += time - emp.lastOTIn;
        day.otOut = time;
      }
      emp.lastOTIn = null;
    }
  });

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '0 ชม.';
    const hrs = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}ชม. ${mins}นาที`;
  };

  const formatTime = (d) => d ? `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}` : '-';

  if (!user) return null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        สรุปข้อมูลการมาทำงานรายเดือน
      </h1>

      <div className="flex gap-4 mb-6">
        <input type="number" value={year} min="2020" max="2100" onChange={e => setYear(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400" />
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400">
          {[...Array(12).keys()].map(m => (<option key={m+1} value={m+1}>{m+1}</option>))}
        </select>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400">
          <option value="all">ทั้งหมด</option>
          {companies.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
        </select>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-4 py-2 border-b text-left">รหัสพนักงาน</th>
              <th className="px-4 py-2 border-b text-left">ชื่อ</th>
              <th className="px-4 py-2 border-b text-left">จำนวนวันที่มาทำงาน</th>
              <th className="px-4 py-2 border-b text-left">ชั่วโมงทำงานรวม</th>
              <th className="px-4 py-2 border-b text-left">ชั่วโมง OT รวม</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(summaryData).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-2 text-center text-gray-500">ไม่มีข้อมูล</td>
              </tr>
            ) : (
              Object.values(summaryData).map(emp => (
                <tr key={emp.empId} className="hover:bg-blue-50">
                  <td className="px-4 py-2 border-r">{emp.empId}</td>
                  <td className="px-4 py-2 border-r text-blue-600 cursor-pointer"
                      onClick={() => setSelectedEmp(emp)}>
                    {emp.name}
                  </td>
                  <td className="px-4 py-2 border-r">{emp.workDays.size}</td>
                  <td className="px-4 py-2 border-r">{formatDuration(emp.totalWorkMs)}</td>
                  <td className="px-4 py-2 border-r">{formatDuration(emp.totalOTMs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- รายละเอียดรายวัน --- */}
      {selectedEmp && (
        <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">รายละเอียด {selectedEmp.name} เดือน {month}/{year}</h2>
            <button className="text-red-500" onClick={() => setSelectedEmp(null)}>ปิด</button>
          </div>
          <table className="min-w-full border-collapse">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-4 py-2 border-b">วันที่</th>
                <th className="px-4 py-2 border-b">เข้างาน</th>
                <th className="px-4 py-2 border-b">ออกงาน</th>
                <th className="px-4 py-2 border-b">เริ่ม OT</th>
                <th className="px-4 py-2 border-b">ออก OT</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedEmp.dailyRecords)
                .sort(([d1],[d2]) => new Date(d1) - new Date(d2))
                .map(([date, rec]) => (
                <tr key={date} className="hover:bg-blue-50">
                  <td className="px-4 py-2 border-r">{date}</td>
                  <td className="px-4 py-2 border-r">{formatTime(rec.checkIn)}</td>
                  <td className="px-4 py-2 border-r">{formatTime(rec.checkOut)}</td>
                  <td className="px-4 py-2 border-r">{formatTime(rec.otIn)}</td>
                  <td className="px-4 py-2 border-r">{formatTime(rec.otOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <strong>สรุปยอด:</strong> มาทำงาน {selectedEmp.workDays.size} วัน, ชม.ทำงานรวม {formatDuration(selectedEmp.totalWorkMs)}, OT {formatDuration(selectedEmp.totalOTMs)}
          </div>
        </div>
      )}
    </div>
  );
}
