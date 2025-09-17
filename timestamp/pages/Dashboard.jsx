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
  ot_in: "otIn",
  ot_out: "otOut",
  ot_in_before: "otInBefore",
  ot_in_after: "otInAfter",
  ot_out_before: "otOutBefore",
  ot_out_after: "otOutAfter"
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
          compRes.data.companies.map((c, index) => ({
            id: index,
            name: c.name,
          }))
        );
      }

      const recRes = await axios.get(
        `https://api-checkin-out.bpit-staff.com/api/time-record?date=${selectedDate}${selectedCompany !== "all" ? `&company=${selectedCompany}` : ""}`
      );
      if (recRes.data.success) setRecords(recRes.data.records || []);
    } catch (err) {
      console.error(err);
    }
  };
  fetchData();
}, [user, selectedDate, selectedCompany]);

  // ฟังก์ชันคำนวณเวลา
  const calcDuration = (start, end) => {
  if (!start || !end || start === "-" || end === "-") return "";
  const s = new Date(`1970-01-01T${start}`);
  const e = new Date(`1970-01-01T${end}`);
  const diffMs = e - s;
  if (diffMs <= 0) return "";
  const hrs = Math.floor(diffMs / (1000*60*60));
  const mins = Math.floor((diffMs % (1000*60*60)) / (1000*60));
  return `${hrs}ชม. ${mins}นาที`;
};
  // สร้าง tableData สำหรับแสดงในตารางหน้าเว็บ
  const tableData = {};
  records.forEach((r) => {
  if (selectedCompany && selectedCompany !== "all" && r.company_name !== selectedCompany) return;

  const key = r.em_code + "_" + r.company_name;
  if (!tableData[key]) {
    const emp = employees.find(
      (e) =>
        (e.em_code.toString() === r.em_code.toString() || e.name === r.em_code) &&
        e.company_name === r.company_name
    );
    tableData[key] = {
      em_code: emp ? emp.em_code : r.em_code,
      name: emp ? emp.name : "-",
      company: r.company_name,
      checkIn: "",
      checkOut: "",
      otIn: "",
      otOut: "",
      otInBefore: "",
      otInAfter: "",
      otOutBefore: "",
      otOutAfter: ""
    };
  }

  const field = typeMap[r.type.toLowerCase()];
  if (field) tableData[key][field] = r.time;
});

  // ฟังก์ชัน export Excel
const exportExcel = async () => {
  if (!selectedCompany || selectedCompany === "all" || !startDate || !endDate) {
    alert("กรุณาเลือกบริษัทและช่วงวันที่ก่อน export Excel");
    return;
  }

  let rangeRecords = [];
  try {
    const res = await axios.get(
      `https://api-checkin-out.bpit-staff.com/api/time-record/range?start=${startDate}&end=${endDate}&company=${selectedCompany}`
    );
    if (res.data.success) rangeRecords = res.data.records;
  } catch (err) {
    console.error(err);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

  // --- Loop แต่ละพนักงาน ---
  employees.forEach(emp => {
    const sheet = workbook.addWorksheet(emp.name || emp.em_code);

    // --- Header ---
    const logo1 = workbook.addImage({ base64: "headerLogoBase64", extension: "png" });
    sheet.addImage(logo1, "B2:D5");

    sheet.mergeCells("E2:H2");
    sheet.getCell("E2").value = "BPIT holdings CO.,LTD.";
    sheet.getCell("E2").font = { bold: true, size: 16 };
    sheet.getCell("E2").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("E3:H3");
    sheet.getCell("E3").value = "TIME RECORD REPORT";
    sheet.getCell("E3").font = { bold: true, size: 14 };
    sheet.getCell("E3").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("E4:H4");
    sheet.getCell("E4").value = `ช่วงเวลา: ${startDate} ถึง ${endDate}`;
    sheet.getCell("E4").alignment = { horizontal: "center" };

    // --- Table Header (เพิ่มคอลัมน์วันที่) ---
    const header = ["วัน/Date", "TIME IN", "TIME OUT",
      "OT IN (ก่อนงาน)", "OT OUT (ก่อนงาน)", "OT IN (หลังงาน)", "OT OUT (หลังงาน)", 
      "ชม.ทำงาน", "ชม. OT"];
    const headerRow = sheet.addRow(header);

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });

    // --- Loop วัน ---
    let rowIndex = 5;
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate()+1)) {
      const dateStr = d.toISOString().slice(0,10);
      const dayName = dayNames[d.getDay()];

      const r = rangeRecords.find(rec => rec.em_code === emp.em_code && rec.date === dateStr) || 
                { checkIn: "-", checkOut: "-", otInBefore: "-", otInAfter: "-", otOutBefore: "-", otOutAfter: "-", otIn: "-", otOut: "-" };

      const row = sheet.addRow([
        `${dayName}`, 
        `${dateStr}`, 
        r.checkIn,
        r.checkOut,
        r.otInBefore,
        r.otOutBefore,
        r.otInAfter,
        r.otOutAfter,
        calcDuration(r.checkIn, r.checkOut),
        calcDuration(r.otIn, r.otOut)
      ]);

      row.eachCell(cell => {
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });

      if (rowIndex % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9E1F2' } };
        });
      }
      rowIndex++;
    }

    // --- Footer ลายเซ็น 3 บรรทัด ---
    const footerStartRow = sheet.lastRow.number + 2;
    sheet.mergeCells(`B${footerStartRow}:D${footerStartRow}`);
sheet.getCell(`B${footerStartRow}`).value = "พนักงานลงชื่อ:";
sheet.getCell(`B${footerStartRow}`).alignment = { vertical:'middle', horizontal:'center' };

sheet.mergeCells(`E${footerStartRow}:G${footerStartRow}`);
sheet.getCell(`E${footerStartRow}`).value = "ผู้อนุมัติ:";
sheet.getCell(`E${footerStartRow}`).alignment = { vertical:'middle', horizontal:'center' };

sheet.mergeCells(`B${footerStartRow+1}:D${footerStartRow+1}`);
sheet.mergeCells(`E${footerStartRow+1}:G${footerStartRow+1}`);
sheet.mergeCells(`B${footerStartRow+2}:D${footerStartRow+2}`);
sheet.mergeCells(`E${footerStartRow+2}:G${footerStartRow+2}`);

    // --- Set column width ---
    sheet.columns.forEach(col => col.width = 18);
  });

  // --- Save file ---
  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `TimeRecords_${startDate}_to_${endDate}.xlsx`);
};

 if (!user) return null;

  return (
   <div className="p-6 bg-gray-50 min-h-screen">
  <h1 className="text-2xl font-bold mb-6 text-gray-800">Dashboard ลงเวลา</h1>

  <div className="flex flex-col md:flex-row gap-4 mb-6">
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
    />
    <select
      value={selectedCompany}
      onChange={(e) => setSelectedCompany(e.target.value)}
      className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
    >
      <option value="all">เลือกบริษัท</option>
      {companies.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
    <div className="flex gap-2 mb-4">
  <input
    type="date"
    value={startDate}
    onChange={(e) => setStartDate(e.target.value)}
    className="px-4 py-2 border rounded-lg"
  />
  <input
    type="date"
    value={endDate}
    onChange={(e) => setEndDate(e.target.value)}
    className="px-4 py-2 border rounded-lg"
  />
</div>
    <button onClick={exportExcel} className="px-4 py-2 bg-blue-500 text-white rounded">
      ดาวน์โหลด Excel
    </button>
  </div>

  {selectedCompany === "all" ? (
    <div className="text-red-500 font-semibold text-lg">กรุณาเลือกบริษัทก่อนแสดงข้อมูล</div>
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
            <th className="border border-gray-300 px-2 py-1">OT IN (ก่อนงาน)</th>
            <th className="border border-gray-300 px-2 py-1">OT OUT (ก่อนงาน)</th>
            <th className="border border-gray-300 px-2 py-1">OT IN (หลังงาน)</th>
            <th className="border border-gray-300 px-2 py-1">OT OUT (หลังงาน)</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(tableData).map((d, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="border border-gray-300 px-2 py-1">{d.em_code}</td>
              <td className="border border-gray-300 px-2 py-1">{d.name}</td>
              <td className="border border-gray-300 px-2 py-1">{d.checkIn || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{d.checkOut || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{d.otInBefore || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{d.otOutBefore || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{d.otInAfter || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{d.otOutAfter || "-"}</td>
              <td className="border border-gray-300 px-2 py-1">{calcDuration(d.checkIn, d.checkOut)}</td>
              <td className="border border-gray-300 px-2 py-1">{calcDuration(d.otIn, d.otOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

  );
}
