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

        const recRes = await axios.get(`https://api-checkin-out.bpit-staff.com/api/time-record?date=${selectedDate}`);
        if (recRes.data.success) setRecords(recRes.data.records || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user, selectedDate]);

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
  if (!selectedCompany || selectedCompany === "all") {
    alert("กรุณาเลือกบริษัทก่อน export Excel");
    return;
  }

  const monthStr = selectedDate.slice(0, 7); // YYYY-MM
  let monthlyRecords = [];
  try {
    const res = await axios.get(
      `https://api-checkin-out.bpit-staff.com/api/time-record/monthly?month=${monthStr}&company=${selectedCompany}`
    );
    if (res.data.success) monthlyRecords = res.data.records;
  } catch (err) {
    console.error(err);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const monthNames = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
  ];
  const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const [year, month] = monthStr.split("-");
  const daysInMonth = new Date(year, month, 0).getDate();

  // สร้าง tableData แยกพนักงาน
  const tableData = {};
  // สร้าง tableData สำหรับทุกพนักงาน
employees.forEach(emp => {
  const key = `${emp.em_code}_${emp.company_name}`;
  tableData[key] = { 
    em_code: emp.em_code, 
    name: emp.name, 
    company: emp.company_name, 
    records: {} 
  };
});

// ใส่ข้อมูลลง tableData
monthlyRecords.forEach(r => {
  const key = `${r.em_code}_${r.company_name}`;
  if (!tableData[key]) return;

  // Normalize วันที่เป็น YYYY-MM-DD
  const d = new Date(r.date);
  const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;

  if (!tableData[key].records[dateKey]) {
    tableData[key].records[dateKey] = {
      checkIn: "-", 
      checkOut: "-", 
      otIn: "-", 
      otOut: "-",
      otInBefore: "-",
      otInAfter: "-",
      otOutBefore: "-",
      otOutAfter: "-"
    };
  }

  const field = typeMap[r.type.toLowerCase()];
  if (field) tableData[key].records[dateKey][field] = r.time;
});

  // สร้าง sheet สำหรับแต่ละพนักงาน
  Object.values(tableData).forEach(empData => {
    const sheet = workbook.addWorksheet(empData.name);
// --- โลโก้  --- // 
 const logo1 = workbook.addImage({ 
      base64:  "header",   extension: "png" }); 
 sheet.addImage(logo1, "B2:C5"); 
 const logo2 = workbook.addImage({ 
      base64: "header2",   extension: "jpg" }); 
 sheet.addImage(logo2, "G1:H5");
    // Header
    sheet.getCell("D2").value = "BPIT holdings CO.,LTD.";
    sheet.getCell("D3").value = "TIME RECORD REPORT";
    sheet.getCell("D4").value = `${monthNames[parseInt(month)-1]} ${year}`;
    sheet.getCell("B7").value = "NO.";
    sheet.getCell("C7").value = empData.em_code;
    sheet.getCell("B8").value = "ชื่อ-นามสกุล:";
    sheet.getCell("C8").value = empData.name;
    sheet.getCell("E8").value = "ตำแหน่ง : ";
    sheet.getCell("F8").value = note;
    sheet.getCell("H8").value = "บริษัท :";
    sheet.getCell("B36").value = ""

    sheet.addRow([]);
    const headerRow = sheet.addRow([
  "วัน",
  "TIME IN",
  "TIME OUT",
  "OT IN (ก่อนเริ่มงาน)",
  "OT OUT (ก่อนเริ่มงาน)",
  "OT IN (หลังเลิกงาน)",
  "OT OUT (หลังเลิกงาน)",
  "ชม.ทำงาน",
  "ชม. OT"
]);
headerRow.eachCell(cell => (cell.font = { bold: true }));

    // Loop วันทำงาน
    for (let d = 1; d <= daysInMonth; d++) {
  const dateStr = `${year}-${month}-${d.toString().padStart(2,"0")}`;
  const dayName = dayNames[new Date(dateStr).getDay()];
  if (dayName === "เสาร์" || dayName === "อาทิตย์") continue;

  const r = empData.records[dateStr] || { 
    checkIn: "-", checkOut: "-", 
    otIn: "-", otOut: "-", 
    otInBefore: "-", otInAfter: "-", 
    otOutBefore: "-", otOutAfter: "-" 
  };

  sheet.addRow([
    `${dayName} ${d}/${month}`,
    r.checkIn,
    r.checkOut,
    r.otIn,
    r.otOut,
    `${r.otInBefore || "-"} / ${r.otInAfter || "-"}`,
    `${r.otOutBefore || "-"} / ${r.otOutAfter || "-"}`,
    calcDuration(r.checkIn, r.checkOut),
    calcDuration(r.otIn, r.otOut),
  ]);
}

    // Set width
    sheet.columns.forEach(col => { col.width = 15; });
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `TimeRecords_${monthStr}.xlsx`);
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
        <button onClick={exportExcel} className="px-4 py-2 bg-blue-500 text-white rounded">
          ดาวน์โหลด Excel
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-auto">
     <table className="min-w-full border border-gray-400 border-collapse">
  <thead className="bg-blue-100 text-gray-700 text-sm">
    {/* แถวหลัก */}
    <tr>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">รหัสพนักงาน</th>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">ชื่อ</th>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">เวลาเข้า</th>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">เวลาออก</th>
      <th colSpan={4} className="border border-gray-400 px-4 py-2 text-center">OT</th>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">ชั่วโมงทำงาน</th>
      <th rowSpan={2} className="border border-gray-400 px-4 py-2">ชั่วโมง OT</th>
    </tr>
    {/* แถวย่อย OT */}
    <tr>
      <th className="border border-gray-400 px-2 py-2 text-center">OT IN (ก่อนงาน)</th>
      <th className="border border-gray-400 px-2 py-2 text-center">OT OUT (ก่อนงาน)</th>
      <th className="border border-gray-400 px-2 py-2 text-center">OT IN (หลังงาน)</th>
      <th className="border border-gray-400 px-2 py-2 text-center">OT OUT (หลังงาน)</th>
    </tr>
  </thead>

  <tbody>
    {Object.values(tableData).map((d, i) => (
      <tr
        key={i}
        className={`text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
      >
        <td className="border border-gray-400 px-4 py-2">{d.em_code}</td>
        <td className="border border-gray-400 px-4 py-2">{d.name}</td>
        <td className="border border-gray-400 px-4 py-2">{d.checkIn || "-"}</td>
        <td className="border border-gray-400 px-4 py-2">{d.checkOut || "-"}</td>

        {/* OT ย่อย */}
        <td className="border border-gray-400 px-2 py-2 text-center">{d.otInBefore || "-"}</td>
        <td className="border border-gray-400 px-2 py-2 text-center">{d.otOutBefore || "-"}</td>
        <td className="border border-gray-400 px-2 py-2 text-center">{d.otInAfter || "-"}</td>
        <td className="border border-gray-400 px-2 py-2 text-center">{d.otOutAfter || "-"}</td>

        <td className="border border-gray-400 px-4 py-2 text-center">{calcDuration(d.checkIn, d.checkOut)}</td>
        <td className="border border-gray-400 px-4 py-2 text-center">{calcDuration(d.otIn, d.otOut)}</td>
      </tr>
    ))}
  </tbody>
</table>


      </div>
    </div>
  );
}
