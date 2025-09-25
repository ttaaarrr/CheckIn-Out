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

  // เตรียมรายการวันในช่วง
  const dayList = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    dayList.push(d.toISOString().split("T")[0]);
  }

  // ดึงข้อมูลรายวันทั้งหมดแบบขนาน แล้วรวมเป็นแถวที่มี date
  let dailyRows = [];
  try {
    const requests = dayList.map(dateStr =>
      axios.get(
        `https://api-checkin-out.bpit-staff.com/api/time-record?date=${dateStr}&company=${selectedCompany}`
      ).then(res => ({ dateStr, data: res.data }))
    );
    const responses = await Promise.all(requests);
    responses.forEach(({ dateStr, data }) => {
      if (data && data.success && Array.isArray(data.records)) {
        data.records.forEach(r => {
          dailyRows.push({ ...r, date: dateStr });
        });
      }
    });

    // ให้ชนิดข้อมูลของรหัสพนักงานเป็นสตริงทั้งหมดเพื่อให้จับคู่คีย์ได้
    dailyRows.forEach(r => { if (r.em_code !== undefined && r.em_code !== null) r.em_code = r.em_code.toString(); });
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

// ทำให้ em_code เป็นสตริง เพื่อให้ key ตรงกัน
empList.forEach(e => { if (e && e.em_code !== undefined && e.em_code !== null) e.em_code = e.em_code.toString(); });

console.log("employees for export:", empList); // ต้องมีข้อมูลตอนนี้
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

  // เติมข้อมูลจริงจากแถวรายวัน
  dailyRows.forEach((r) => {
    const dateStr = r.date;
    const key = `${r.em_code}_${dateStr}`;
    if (!groupedRecords[key]) return;

    const type = (r.type || '').toLowerCase();
    if (type === 'in') groupedRecords[key].checkIn = r.time || '-';
    else if (type === 'out') groupedRecords[key].checkOut = r.time || '-';
    else if (type === 'ot_in_before') groupedRecords[key].otInBefore = r.time || '-';
    else if (type === 'ot_out_before') groupedRecords[key].otOutBefore = r.time || '-';
    else if (type === 'ot_in_after') groupedRecords[key].otInAfter = r.time || '-';
    else if (type === 'ot_out_after') groupedRecords[key].otOutAfter = r.time || '-';
  });

  // สร้าง Excel
  const workbook = new ExcelJS.Workbook();
  const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
const formatDateTH = (dateStr) => {
  const d = new Date(dateStr);
   if (isNaN(d)) return "-";
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}
  // โหลดโลโก้เป็น ArrayBuffer (Browser-compatible)
  const fetchLogoBuffer = async (url) => {
    const res = await fetch(url);
    return await res.arrayBuffer();
  };
  const logoLeftBuffer = await fetchLogoBuffer('/logo_black.png'); // public/logo_black.png
  const logoRightBuffer = await fetchLogoBuffer('/logo.jpg');       // public/logo.jpg

  empList.forEach((emp) => {
  const sheet = workbook.addWorksheet(emp.name || emp.em_code);

  const logoLeftId = workbook.addImage({
  buffer: logoLeftBuffer,
  extension: 'png'
});
const logoRightId = workbook.addImage({
  buffer: logoRightBuffer,
  extension: 'jpg'
});

const periodText = `บันทึกเวลาวันที่ ${formatDateTH(startDate)} - ${formatDateTH(endDate)}`;
// วางโลโก้ซ้าย
sheet.addImage(logoLeftId, {
  tl: { col: 1, row: 0 }, // top-left cell
  br: { col: 3, row: 4 }, // bottom-right cell (ครอบคลุมหลาย cell)
  editAs: 'oneCell'
});

// วางโลโก้ขวา
sheet.addImage(logoRightId, {
  tl: { col: 7, row: 0 },
  br: { col: 9, row: 4 },
  editAs: 'oneCell'
});
   // assume workbook and sheet ถูกสร้างแล้ว
sheet.pageSetup = {
  paperSize: 9,           // A4
  orientation: 'portrait',
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 1,
  margins: {
    left: 0.5, right: 0.5,
    top: 0.5, bottom: 0.5,
    header: 0.3, footer: 0.3
  }
};

// Header
sheet.mergeCells("D2:G2");
sheet.getCell("D2").value = "BPIT Holdings CO.,LTD.";
sheet.getCell("D2").font = { bold: true, size: 14 };
sheet.getCell("D2").alignment = { horizontal: "center" };

sheet.mergeCells("D3:G3");
sheet.getCell("D3").value = "TIME RECORD REPORT";
sheet.getCell("D3").font = { bold: true, size: 12 };
sheet.getCell("D3").alignment = { horizontal: "center" };

sheet.mergeCells("D4:G4");
sheet.getCell("D4").value = periodText;
sheet.getCell("D4").alignment = { horizontal: "center" };

// Employee info
sheet.mergeCells("B7:C7"); sheet.getCell("B7").value = `ชื่อ: ${emp.name}`;
sheet.mergeCells("B8:C8"); sheet.getCell("B8").value = `รหัส: ${emp.em_code}`;
sheet.mergeCells("B9:C9"); sheet.getCell("B9").value = `บริษัท: BPIT Holdings`;
sheet.mergeCells("E9:G9"); sheet.getCell("E9").value = `สังกัดบริษัทลูกค้า: ${emp.company_name || selectedCompany}`;
sheet.mergeCells("I9:K9"); sheet.getCell("I9").value = `ชื่อหน่วยงานสังกัด:`;
sheet.mergeCells("B10:C10"); sheet.getCell("B10").value = `ตำแหน่ง: ${emp.position || "-"}`;
sheet.getCell("B11").value = ` `;

// Two-level grouped header
// const topHeader = [
//   "วัน", "วัน/เดือน/ปี", 
//   "เวลางานปกติ", "OT ก่อนเข้างาน", "OT หลังเลิกงาน", 
//   "ชม.ทำงาน", "ชม. OT", "หมายเหตุ"
// ];
// const headerRow1 = sheet.addRow(topHeader);

// สร้างหัวตาราง (2 แถว)
sheet.mergeCells('A13:A14'); // วัน
sheet.mergeCells('B13:B14'); // วัน/เดือน/ปี
sheet.mergeCells('C13:D13'); // เวลางานปกติ
sheet.mergeCells('E13:F13'); // OT ก่อนเริ่มงาน
sheet.mergeCells('G13:H13'); // OT หลังเลิกงาน
sheet.mergeCells('I13:I14'); // ชม.ทำงาน
sheet.mergeCells('J13:J14'); // ชม.OT
sheet.mergeCells('K13:K14'); // หมายเหตุ

// ตั้งค่าหัวแถวหลัก
sheet.getCell('A13').value = 'วัน';
sheet.getCell('B13').value = 'วัน/เดือน/ปี';
sheet.getCell('C13').value = 'เวลางานปกติ';
sheet.getCell('E13').value = 'OT ก่อนเริ่มงาน';
sheet.getCell('G13').value = 'OT หลังเลิกงาน';
sheet.getCell('I13').value = 'ชม.ทำงาน';
sheet.getCell('J13').value = 'ชม. OT';
sheet.getCell('K13').value = 'หมายเหตุ';

// ตั้งค่าหัวแถวรอง (แถว 2)
sheet.getCell('C14').value = 'เข้า';
sheet.getCell('D14').value = 'ออก';
sheet.getCell('E14').value = 'เข้า';
sheet.getCell('F14').value = 'ออก';
sheet.getCell('G14').value = 'เข้า';
sheet.getCell('H14').value = 'ออก';


// จัดสไตล์หัวตาราง
['A13','B13','C13','E13','G13','I13','J13','K13',
 'C14','D14','E14','F14','G14','H14','J14','K14'].forEach(cell => {
  sheet.getCell(cell).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell(cell).font = { bold: true };
  sheet.getCell(cell).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F4E78' } // น้ำเงินเข้ม
  };
  sheet.getCell(cell).font = { color: { argb: 'FFFFFF' }, bold: true }; // ตัวอักษรขาว
  sheet.getCell(cell).border = {
    top: {style:'thin'},
    left: {style:'thin'},
    bottom: {style:'thin'},
    right: {style:'thin'}
  };
});

// จัดความกว้างคอลัมน์
sheet.columns = [
  { key: 'day', width: 8 },
  { key: 'date', width: 15 },
  { key: 'in', width: 10 },
  { key: 'out', width: 10 },
  { key: 'ot_before_in', width: 10 },
  { key: 'ot_before_out', width: 10 },
  { key: 'ot_after_in', width: 10 },
  { key: 'ot_after_out', width: 10 },
  { key: 'work_hours', width: 12 },
  { key: 'ot_hours_in', width: 10 },
  { key: 'ot_hours_out', width: 10 },
  { key: 'note', width: 20 }
];
// Column width
sheet.columns = [
  { width: 10}, {width:12},
  {width:10}, {width:10},
  {width:12}, {width:12},
  {width:12}, {width:12},
  {width:10}, {width:10}, {width:12}
];

// Fill data
dayList.forEach((dateStr, idx) => {
  const key = `${emp.em_code}_${dateStr}`;
  const r = groupedRecords[key];
  if (!r) return;

  const row = sheet.addRow([
    dayNames[new Date(dateStr).getDay()],
    dateStr,
    r.checkIn, r.checkOut,
    r.otInBefore, r.otOutBefore,
    r.otInAfter, r.otOutAfter,
    calcDuration(r.checkIn, r.checkOut),
    calcTotalOT(r),
    r.note || ""
  ]);

  row.eachCell({ includeEmpty: true }, cell => {
    cell.alignment = { horizontal: "center", vertical: "middle" }; 
    cell.border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
  });

  // สลับสีแถว (optional)
  if(idx % 2 === 0) row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFD9E1F2"} };
  });

  row.height = 18; // ตั้ง row height ให้ uniform
});

// Footer
const footerStartRow = sheet.lastRow.number + 3;

// เจ้าหน้าที่BPIT
sheet.mergeCells(`B${footerStartRow}:C${footerStartRow+1}`);
sheet.getCell(`B${footerStartRow}`).value = "เจ้าหน้าที่BPIT:";
sheet.getCell(`B${footerStartRow}`).alignment = { vertical:'bottom', horizontal:'left' };

// พนักงาน
sheet.mergeCells(`E${footerStartRow}:F${footerStartRow+1}`);
sheet.getCell(`E${footerStartRow}`).value = "พนักงาน:";
sheet.getCell(`E${footerStartRow}`).alignment = { vertical:'bottom', horizontal:'left' };

// ผู้อนุมัติ
sheet.mergeCells(`H${footerStartRow}:I${footerStartRow+1}`);
sheet.getCell(`H${footerStartRow}`).value = "ผู้อนุมัติ:";
sheet.getCell(`H${footerStartRow}`).alignment = { vertical:'bottom', horizontal:'left' };

// ลายเซ็นเจ้าหน้าที่BPIT
sheet.mergeCells(`B${footerStartRow+2}:C${footerStartRow+3}`);
sheet.getCell(`B${footerStartRow+2}`).value = "(...........................................)";
sheet.getCell(`B${footerStartRow+2}`).alignment = { vertical:'bottom', horizontal:'center' };

// ลายเซ็นพนักงาน
sheet.mergeCells(`E${footerStartRow+2}:F${footerStartRow+3}`);
sheet.getCell(`E${footerStartRow+2}`).value = "(...........................................)";
sheet.getCell(`E${footerStartRow+2}`).alignment = { vertical:'bottom', horizontal:'center' };

// ลายเซ็นผู้อนุมัติ
sheet.mergeCells(`H${footerStartRow+2}:I${footerStartRow+3}`);
sheet.getCell(`H${footerStartRow+2}`).value = "(...........................................)";
sheet.getCell(`H${footerStartRow+2}`).alignment = { vertical:'bottom', horizontal:'center' };

// Row height footer
for(let i=footerStartRow; i<=footerStartRow+3; i++) sheet.getRow(i).height = 25;

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
