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

  // ดึงข้อมูลจาก API range
  let rangeRecords = [];
  try {
    const res = await axios.get(
      `https://api-checkin-out.bpit-staff.com/api/time-record/range?start=${startDate}&end=${endDate}&company=${selectedCompany}`
    );
    if (res.data.success) rangeRecords = res.data.records;

      console.log("rangeRecords:", rangeRecords);
      console.log("employees:", employees);

      rangeRecords.forEach(r => { if (r.empId !== undefined && r.empId !== null) r.empId = r.empId.toString(); });
      employees.forEach(e => { if (e.em_code !== undefined && e.em_code !== null) e.em_code = e.em_code.toString(); });
  } catch (err) {
    console.error(err);
    return;
  }
  // ดึง employees
 let empList = employees; // เอา state employees
if (!empList.length) {
  try {
    const empRes = await axios.get(
      `https://api-checkin-out.bpit-staff.com/api/employees?company_name=${selectedCompany}`
    );
    if (empRes.data.success) empList = empRes.data.employees || [];
  } catch (err) {
    console.error(err);
    alert("ไม่สามารถดึงข้อมูลพนักงานได้");
    return;
  }
}

// ทำให้ em_code เป็นสตริง เพื่อให้ key ตรงกับ empId ที่แปลงเป็นสตริงแล้ว
empList.forEach(e => { if (e && e.em_code !== undefined && e.em_code !== null) e.em_code = e.em_code.toString(); });

console.log("employees for export:", empList); // ต้องมีข้อมูลตอนนี้
  // สร้าง list วัน
  const dayList = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    dayList.push(d.toISOString().split("T")[0]);
  }

  // สร้าง groupedRecords: emp+date
  const groupedRecords = {};
  empList.forEach((emp) => {
    dayList.forEach((dateStr) => {
      const key = `${emp.em_code}_${dateStr}`;
      groupedRecords[key] = {
        em_code: emp.em_code,
        name: emp.name,
        date: dateStr,
        checkIn: "-",
        checkOut: "-",
        otInBefore: "-",
        otOutBefore: "-",
        otInAfter: "-",
        otOutAfter: "-",
        company_name: emp.company_name || selectedCompany,
      };
    });
  });

  // เติมข้อมูลจริงจาก API
  rangeRecords.forEach((r) => {
    if (!r.date) return;
    const dateStr = r.date.split("T")[0];
    const key = `${r.empId}_${dateStr}`;
    if (groupedRecords[key]) {
      groupedRecords[key].checkIn = r.inTime || "-";
      groupedRecords[key].checkOut = r.outTime || "-";
      groupedRecords[key].otInBefore = r.otInBefore || "-";
      groupedRecords[key].otOutBefore = r.otOutBefore || "-";
      groupedRecords[key].otInAfter = r.otInAfter || "-";
      groupedRecords[key].otOutAfter = r.otOutAfter || "-";
    }
  });

  // สร้าง Excel
  const workbook = new ExcelJS.Workbook();
  const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

  empList.forEach((emp) => {
  const sheet = workbook.addWorksheet(emp.name || emp.em_code);

    // Header
    sheet.mergeCells("E2:G2");
    sheet.getCell("E2").value = "BPIT holdings CO.,LTD.";
    sheet.getCell("E2").font = { bold: true, size: 16 };
    sheet.getCell("E2").alignment = { horizontal: "center" };

    sheet.mergeCells("E3:G3");
    sheet.getCell("E3").value = "TIME RECORD REPORT";
    sheet.getCell("E3").font = { bold: true, size: 14 };
    sheet.getCell("E3").alignment = { horizontal: "center" };

    sheet.mergeCells("E4:G4");
    sheet.getCell("E4").value = `ช่วงเวลา: ${startDate} ถึง ${endDate}`;
    sheet.getCell("E4").alignment = { horizontal: "center" };

    sheet.mergeCells("B7:C7");
    sheet.getCell("B7").value = `ชื่อ: ${emp.name}`;
    sheet.mergeCells("B8:C8");
    sheet.getCell("B8").value = `ตำแหน่ง: ${emp.position || "-"}`;
    sheet.mergeCells("B9:C9");
    sheet.getCell("B9").value = `รหัส: ${emp.em_code}`;
    sheet.mergeCells("B10:C10");
    sheet.getCell("B10").value = `บริษัท: ${emp.company_name || selectedCompany}`;
    sheet.mergeCells("B11:C11");
    sheet.getCell("B11").value = ` `;

    const header = ["วัน","วัน/เดือน/ปี","เวลาเข้า","เวลาออก",
      "OT IN (ก่อนเข้างาน)","OT OUT (ก่อนเข้างาน)","OT IN (หลังเลิกงาน)","OT OUT (หลังเลิกงาน)",
      "ชม.ทำงาน","ชม. OT"
    ];
    const headerRow = sheet.addRow(header);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
    });

    sheet.columns = [
      { width: 12},{width:15},{width:12},{width:12},
      {width:18},{width:18},{width:18},{width:18},
      {width:12},{width:12}
    ];

    // เติมข้อมูล
   dayList.forEach((dateStr, idx) => {
  const key = `${emp.em_code}_${dateStr}`;
  const r = groupedRecords[key];
  if (!r) return; // <-- ใส่ตรงนี้เลย

  const otStart = r.otInBefore !== "-" ? r.otInBefore : (r.otInAfter !== "-" ? r.otInAfter : "");
  const otEnd = r.otOutBefore !== "-" ? r.otOutBefore : (r.otOutAfter !== "-" ? r.otOutAfter : "");

  const row = sheet.addRow([
    dayNames[new Date(dateStr).getDay()],
    dateStr,
    r.checkIn,
    r.checkOut,
    r.otInBefore,
    r.otOutBefore,
    r.otInAfter,
    r.otOutAfter,
    calcDuration(r.checkIn, r.checkOut),
    calcDuration(otStart, otEnd)
  ]);

  row.eachCell(cell => {
    cell.border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
  });

  if (idx % 2 === 0) {
    row.eachCell(cell => { cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFD9E1F2"} }; });
  }
});
    
 // Footer
      const footerStartRow = sheet.lastRow.number + 3;
      sheet.mergeCells(`B${footerStartRow}:D${footerStartRow}`);
      sheet.getCell(`B${footerStartRow}`).value = "พนักงานลงชื่อ:";
      sheet.getCell(`B${footerStartRow}`).alignment = { vertical:'middle', horizontal:'left' };

      sheet.mergeCells(`F${footerStartRow}:H${footerStartRow}`);
      sheet.getCell(`F${footerStartRow}`).value = "ผู้อนุมัติ:";
      sheet.getCell(`F${footerStartRow}`).alignment = { vertical:'middle', horizontal:'left' };

      sheet.mergeCells(`B${footerStartRow + 1}:D${footerStartRow + 1}`);
      sheet.getCell(`B${footerStartRow + 1}`).value = "(...........................................)";
      sheet.getCell(`B${footerStartRow + 1}`).alignment = { vertical:'middle', horizontal:'center' };

      sheet.mergeCells(`F${footerStartRow + 1}:H${footerStartRow + 1}`);
      sheet.getCell(`F${footerStartRow + 1}`).value = "(...........................................)";
      sheet.getCell(`F${footerStartRow + 1}`).alignment = { vertical:'middle', horizontal:'center' };
    });

  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `TimeRecords_${startDate}_to_${endDate}.xlsx`);
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
