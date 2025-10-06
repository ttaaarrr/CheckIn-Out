import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const typeMap = {
    in: "checkIn",
    out: "checkOut",
    ot_in_before: "otInBefore",
    ot_out_before: "otOutBefore",
    ot_in_after: "otInAfter",
    ot_out_after: "otOutAfter",
  };

  // ตรวจสอบล็อกอิน
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Fetch employees
  useEffect(() => {
    if (!user) return;
    const fetchEmployees = async () => {
      try {
        const url =
          selectedCompany === "all"
            ? "https://api-checkin-out.bpit-staff.com/api/employees?company_name=A"
            : `https://api-checkin-out.bpit-staff.com/api/employees?company_name=${selectedCompany}`;
        const res = await axios.get(url);
        if (res.data.success) setEmployees(res.data.employees);
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployees();
  }, [user, selectedCompany]);

  // Fetch companies + records
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const compRes = await axios.get("https://api-checkin-out.bpit-staff.com/api/company");
        if (compRes.data.success) {
          setCompanies(
            compRes.data.companies.map((c, index) => ({ id: index, name: c.name }))
          );
        }

        const recRes = await axios.get(
          `https://api-checkin-out.bpit-staff.com/api/time-record?date=${selectedDate}${
            selectedCompany !== "all" ? `&company=${selectedCompany}` : ""
          }`
        );
        if (recRes.data.success) setRecords(recRes.data.records || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user, selectedDate, selectedCompany]);

  // คำนวณเวลา
  const calcDuration = (start, end) => {
    if (!start || !end || start === "-" || end === "-") return "-";
    const s = new Date(`1970-01-01T${start}`);
    const e = new Date(`1970-01-01T${end}`);
    const diffMs = e - s;
    if (diffMs <= 0) return "-";
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}ชม. ${mins}นาที`;
  };

  const calcTotalOT = (r) => {
    const periods = [
      { start: r.otInBefore, end: r.otOutBefore },
      { start: r.otInAfter, end: r.otOutAfter },
    ];
    let totalMinutes = 0;
    periods.forEach(p => {
      if (p.start && p.end && p.start !== "-" && p.end !== "-") {
        const s = new Date(`1970-01-01T${p.start}`);
        const e = new Date(`1970-01-01T${p.end}`);
        const diffMs = e - s;
        if (diffMs > 0) totalMinutes += diffMs / (1000 * 60);
      }
    });
    if (totalMinutes === 0) return "-";
    const hrs = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    return `${hrs}ชม. ${mins}นาที`;
  };
 const getLocalDateStr = (dateStr) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  // สร้าง tableData หน้าเว็บ
  const tableData = {};
  records.forEach((r) => {
    if (!r.type || !r.em_code) return;
     if (selectedCompany !== "all" && r.company_name !== selectedCompany) return;
    const key = `${r.em_code}_${getLocalDateStr(selectedDate)}`;
    if (!tableData[key]) {
      const emp = employees.find(e => e.em_code.toString() === r.em_code.toString());
      tableData[key] = {
        em_code: r.em_code,
        name: emp ? emp.name : r.name || "-",
        company: r.company_name || selectedCompany,
        checkIn: "-",
        checkOut: "-",
        otInBefore: "-",
        otOutBefore: "-",
        otInAfter: "-",
        otOutAfter: "-",
      };
    }
    const field = typeMap[r.type.toLowerCase()];
    if (field) tableData[key][field] = r.time || "-";
  });

const exportExcel = async () => {
  if (!selectedCompany || selectedCompany === "all" || !startDate || !endDate) {
    alert("กรุณาเลือกบริษัทและช่วงวันที่ก่อน export Excel");
    return;
  }

  // เตรียมรายการวันในช่วง
  const dayList = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    dayList.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  // ดึงข้อมูลรายวันทั้งหมดแบบขนาน แล้วรวมเป็นแถวที่มี date
  let dailyRows = [];
  try {
    const requests = dayList.map(dateStr =>
      axios.get(`https://api-checkin-out.bpit-staff.com/api/time-record?date=${dateStr}&company=${selectedCompany}`)
        .then(res => ({ dateStr, data: res.data }))
    );
    const responses = await Promise.all(requests);
    responses.forEach(({ dateStr, data }) => {
      if (data && data.success && Array.isArray(data.records)) {
        data.records.forEach(r => {
          if (r.em_code !== undefined && r.em_code !== null) r.em_code = r.em_code.toString(); // แปลงเป็น string
          dailyRows.push({ ...r, date: dateStr });
        });
      }
    });
  } catch (err) {
    console.error(err);
    return;
  }

  // ดึง employees
  let empList = employees;
  if (!empList.length) {
    try {
      const empRes = await axios.get(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${selectedCompany}`);
      if (empRes.data.success) empList = empRes.data.employees || [];
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถดึงข้อมูลพนักงานได้");
      return;
    }
  }

  // แปลง em_code เป็น string
  empList.forEach(e => { if (e && e.em_code !== undefined && e.em_code !== null) e.em_code = e.em_code.toString(); });

  // สร้าง groupedRecords: key = em_code + date
  const groupedRecords = {};
  empList.forEach((emp) => {
    const empCodeStr = emp.em_code?.toString() || '';
    dayList.forEach((dateStr) => {
      const key = `${empCodeStr}_${dateStr}`;
      groupedRecords[key] = {
        em_code: empCodeStr,
        name: emp.name,
        date: dateStr,
        checkIn: "-",
        checkOut: "-",
        otInBefore: "-",
        otOutBefore: "-",
        otInAfter: "-",
        otOutAfter: "-",
        note: "",
        company_name: emp.company_name || selectedCompany
      };
    });
  });

  // เติมข้อมูลจริงจาก dailyRows
  dailyRows.forEach((r) => {
    const key = `${r.em_code}_${r.date}`;
    if (!groupedRecords[key]) return;
    const type = (r.type || '').toLowerCase();
    if (type === 'in') groupedRecords[key].checkIn = r.time || '-';
    else if (type === 'out') groupedRecords[key].checkOut = r.time || '-';
    else if (type === 'ot_in_before') groupedRecords[key].otInBefore = r.time || '-';
    else if (type === 'ot_out_before') groupedRecords[key].otOutBefore = r.time || '-';
    else if (type === 'ot_in_after') groupedRecords[key].otInAfter = r.time || '-';
    else if (type === 'ot_out_after') groupedRecords[key].otOutAfter = r.time || '-';
    if (r.note) groupedRecords[key].note = r.note;
  });

  // สร้าง workbook
  const workbook = new ExcelJS.Workbook();
  const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const monthNames = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
    "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
    "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
  ];
  const formatDateTH = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return "-";
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  // โหลดโลโก้
  const fetchLogoBuffer = async (url) => {
    const res = await fetch(url);
    return await res.arrayBuffer();
  };
  const logoLeftBuffer = await fetchLogoBuffer('/log.png');

  empList.forEach((emp) => {
    const sheet = workbook.addWorksheet(emp.name || emp.em_code);

    const logoLeftId = workbook.addImage({ buffer: logoLeftBuffer, extension: 'png' });
    sheet.addImage(logoLeftId, { tl: { col: 1, row: 0 }, br: { col: 3, row: 4 }, editAs: 'oneCell' });

    sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth:1, fitToHeight:1,
      margins: { left:0.5, right:0.5, top:0.5, bottom:0.5, header:0.3, footer:0.3 } };

    // Header + Employee info
    sheet.getCell("E2").value = { richText:[{ text:"BPIT", font:{ italic:true, color:{argb:"000080"}, bold:true, size:14 } },
      { text:" Holdings CO.,LTD; www.bpit.co.th", font:{ color:{argb:"000080"}, bold:true, size:14 } }] };
    sheet.getCell("E2").alignment = { horizontal:"left" };
    sheet.getCell("E3").value = "TIME RECORD REPORT";
    sheet.getCell("E3").font = { bold:true, size:12, color:{argb:"000080"}, underline:true };
    sheet.getCell("E3").alignment = { horizontal:"left" };
    sheet.getCell("E4").value = `บันทึกเวลา; วันที่ ${formatDateTH(startDate)} - ${formatDateTH(endDate)}`;
    sheet.getCell("E4").font = { bold:true, size:12, color:{argb:"000080"} };
    sheet.getCell("E4").alignment = { horizontal:"left" };

    // Employee info
    sheet.getCell("B6").value = { richText:[{ text:"ชื่อ: ", font:{ bold:true } }, { text: emp.name }] };
    sheet.getCell("B7").value = { richText:[{ text:"ตำแหน่ง: ", font:{ bold:true } }, { text: emp.position||"-" }] };
    sheet.getCell("E6").value = { richText:[{ text:"รหัส: ", font:{ bold:true } }, { text: emp.em_code }] };
    sheet.getCell("E7").value = { richText:[{ text:"สังกัดลูกค้า: ", font:{ bold:true } }, { text: emp.company_name||selectedCompany }] };

    // Header ตาราง
    sheet.mergeCells('A9:A10'); sheet.mergeCells('B9:B10'); sheet.mergeCells('C9:D9');
    sheet.mergeCells('E9:F9'); sheet.mergeCells('G9:H9'); sheet.mergeCells('I9:I10'); sheet.mergeCells('J9:M9');
    sheet.getCell('A9').value='วัน'; sheet.getCell('B9').value='วัน/เดือน/ปี'; sheet.getCell('C9').value='เวลางานปกติ';
    sheet.getCell('E9').value='OT ก่อนเริ่มงาน'; sheet.getCell('G9').value='OT หลังเลิกงาน'; sheet.getCell('I9').value='ชม.ทำงาน';
    sheet.getCell('J9').value='ชม. OT'; sheet.getCell('N9').value='หมายเหตุ';
    sheet.getCell('C10').value='เข้า'; sheet.getCell('D10').value='ออก'; sheet.getCell('E10').value='เข้า';
    sheet.getCell('F10').value='ออก'; sheet.getCell('G10').value='เข้า'; sheet.getCell('H10').value='ออก';
    sheet.getCell('J10').value='1เท่า'; sheet.getCell('K10').value='1.5เท่า'; sheet.getCell('L10').value='2เท่า';
    sheet.getCell('M10').value='3เท่า'; sheet.getCell('N10').value='(ป่วย/กิจ/พักร้อน)';

    // Style header
    ['A9','B9','C9','E9','G9','I9','J9','N9','C10','D10','E10','F10','G10','H10','J10','K10','L10','M10','N10'].forEach(cell => {
      sheet.getCell(cell).alignment={vertical:'middle', horizontal:'center'};
      if(cell==='N10') sheet.getCell(cell).font={color:{argb:'FFFFFF'}, bold:true, size:8};
      else sheet.getCell(cell).font={color:{argb:'FFFFFF'}, bold:true};
      sheet.getCell(cell).fill={type:'pattern', pattern:'solid', fgColor:{argb:'1F4E78'}};
      sheet.getCell(cell).border={top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'}};
    });

    // Column width
    sheet.columns = [
      {width:10},{width:12},{width:10},{width:10},{width:12},{width:12},{width:12},{width:12},
      {width:10},{width:10},{width:10},{width:10},{width:10},{width:12}
    ];

    // Fill data
    dayList.forEach(dateStr => {
      const key = `${emp.em_code}_${dateStr}`;
      const r = groupedRecords[key];
      if(!r) return;
      const row = sheet.addRow([
        dayNames[new Date(dateStr).getDay()],
        dateStr,
        r.checkIn, r.checkOut,
        r.otInBefore, r.otOutBefore,
        r.otInAfter, r.otOutAfter,
        calcDuration(r.checkIn,r.checkOut),
        "","","","",
        r.note||""
      ]);
      row.eachCell({includeEmpty:true}, cell => {
        cell.alignment={horizontal:"center", vertical:"middle"};
        cell.border={top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"}};
      });
      row.height=18;
    });
  });

  // Save file
  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `TimeRecords_${startDate}_${endDate}.xlsx`);
};


  if (!user) return null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">ตารางบันทึกการลงเวลา</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"/>
        <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
          className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="all">เลือกบริษัท</option>
          {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"/>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"/>
          <button onClick={exportExcel} className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition">
            ดาวน์โหลด Excel
          </button>
        </div>
      </div>

      {selectedCompany === "all" ? (
        <div className="text-red-500 font-semibold text-lg flex justify-center items-center">กรุณาเลือกบริษัทก่อนแสดงข้อมูล</div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-auto">
          <table className="min-w-full border border-gray-300 border-collapse">
            <thead className="bg-blue-50">
              <tr>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">รหัสพนักงาน</th>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">ชื่อ</th>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">เวลาเข้า</th>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">เวลาออก</th>
                <th colSpan={4} className="border border-gray-300 px-2 py-1 text-center">OT</th>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">ชั่วโมงทำงาน</th>
                <th rowSpan={2} className="border border-gray-300 px-2 py-1">ชั่วโมง OT</th>
              </tr>
              <tr>
                <th className="border border-gray-300 px-2 py-1">OT IN (ก่อนเข้างาน)</th>
                <th className="border border-gray-300 px-2 py-1">OT OUT (ก่อนเข้างาน)</th>
                <th className="border border-gray-300 px-2 py-1">OT IN (หลังเลิกงาน)</th>
                <th className="border border-gray-300 px-2 py-1">OT OUT (หลังเลิกงาน)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(tableData).map((r, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="border px-2 py-1">{r.em_code}</td>
                  <td className="border px-2 py-1">{r.name}</td>
                  <td className="border px-2 py-1">{r.checkIn}</td>
                  <td className="border px-2 py-1">{r.checkOut}</td>
                  <td className="border px-2 py-1">{r.otInBefore}</td>
                  <td className="border px-2 py-1">{r.otOutBefore}</td>
                  <td className="border px-2 py-1">{r.otInAfter}</td>
                  <td className="border px-2 py-1">{r.otOutAfter}</td>
                  <td className="border px-2 py-1">{calcDuration(r.checkIn, r.checkOut)}</td>
                  <td className="border px-2 py-1">{calcTotalOT(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
