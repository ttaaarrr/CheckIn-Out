import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

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

// mapping ชื่อเก่า -> ชื่อใหม่
const companyNameMap = {
"บริษัทเก่า": "ชื่อใหม่",
"OldCo": "NewCo"
};
  // Fetch employees
useEffect(() => {
  if (!user) return;

  const fetchCompaniesAndEmployees = async () => {
    try {
      // 1. fetch companies
      const compRes = await axios.get("https://api-checkin-out.bpit-staff.com/api/company");
      if (!compRes.data.success) return;

      const companyList = compRes.data.companies.map((c, index) => ({ id: index, name: c.name }));
      setCompanies(companyList);

      // สร้าง map สำหรับ mapping ชื่อบริษัท -> id
      const companyMap = {};
      companyList.forEach(c => {
        const normalized = c.name.replace(/\s+/g, ' ').trim();
        companyMap[normalized] = c.id;
      });

      // 2. fetch employees
      const url =
        selectedCompany === "all"
          ? "https://api-checkin-out.bpit-staff.com/api/employees?company_name=A"
          : `https://api-checkin-out.bpit-staff.com/api/employees?company_name=${selectedCompany}`;
      const empRes = await axios.get(url);
      if (!empRes.data.success) return;

      const employeesWithId = empRes.data.employees.map(emp => {
        const companyName = (companyNameMap[emp.company_name?.trim()] || emp.company_name || "").replace(/\s+/g, ' ').trim();
        return {
          ...emp,
          company_id: companyMap[companyName] ?? null
        };
      });

      setEmployees(employeesWithId);
      console.log("🟢 Employees with ID:", employeesWithId);

    } catch (err) {
      console.error(err);
    }
  };

  fetchCompaniesAndEmployees();
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
          `https://api-checkin-out.bpit-staff.com/api/time-record?date=${formatDateForApi(selectedDate)}${
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
 const toDate = (value) => (value instanceof Date ? value : new Date(value));
 const formatDateForApi = (date) =>
    date ? toDate(date).toISOString().split("T")[0] : "";

 const getLocalDateStr = (value) => {
    if (!value) return "-";
    const d = toDate(value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  };
  
  // สร้าง tableData หน้าเว็บ
  const tableData = {};
 records.forEach((r) => {
  if (!r.type || !r.em_code) return;
  
  // ตรวจสอบบริษัทก่อน
  if (selectedCompany !== "all" && r.company_name !== selectedCompany) return;

  const key = `${r.em_code}_${getLocalDateStr(selectedDate)}`;
  if (!tableData[key]) {
    const emp = employees.find(e => e.em_code.toString() === r.em_code.toString());
    tableData[key] = {
      em_code: r.em_code,
      name: emp ? emp.name : r.name || "-",
      company_id: emp ? emp.company_id : undefined,
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
  if (startDate && endDate) {
    const current = new Date(startDate);
    const last = new Date(endDate);
    while (current <= last) {
      dayList.push(formatDateForApi(current));
      current.setDate(current.getDate() + 1);
    }
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

// เติมข้อมูลจริงจาก dailyRows
dailyRows.forEach((r) => {

   const emp = employees.find(e => e.em_code.toString() === r.em_code.toString());

  if (!emp) {
    console.warn("ไม่พบพนักงานที่ตรงกับ:", r.em_code);
    return;
  }

  const dateStr = r.date;
  const key = `${emp.em_code}_${dateStr}`;
  if (!groupedRecords[key]) {
    console.warn("ไม่พบ key:", key);
    return;
  }

  const type = (r.type || '').toLowerCase();
  if (type === 'in') groupedRecords[key].checkIn = r.time || '-';
  else if (type === 'out') groupedRecords[key].checkOut = r.time || '-';
  else if (type === 'ot_in_before') groupedRecords[key].otInBefore = r.time || '-';
  else if (type === 'ot_out_before') groupedRecords[key].otOutBefore = r.time || '-';
  else if (type === 'ot_in_after') groupedRecords[key].otInAfter = r.time || '-';
  else if (type === 'ot_out_after') groupedRecords[key].otOutAfter = r.time || '-';

  if (r.note) groupedRecords[key].note = r.note;
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
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
  // โหลดโลโก้เป็น ArrayBuffer (Browser-compatible)
  const fetchLogoBuffer = async (url) => {
    const res = await fetch(url);
    return await res.arrayBuffer();
  };
  const logoLeftBuffer = await fetchLogoBuffer('/log.png'); 
 
  empList.forEach((emp) => {
  const sheet = workbook.addWorksheet(emp.name || emp.em_code);

  const logoLeftId = workbook.addImage({
  buffer: logoLeftBuffer,
  extension: 'png'
});


const periodText = `บันทึกเวลา; วันที่ ${formatDateTH(startDate)} - ${formatDateTH(endDate)}`;
// วางโลโก้ซ้าย
sheet.addImage(logoLeftId, {
  tl: { col: 1, row: 0 }, // top-left cell
  br: { col: 3, row: 4 }, // bottom-right cell (ครอบคลุมหลาย cell)
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

sheet.getCell("E2").value = {
  richText: [
    { text: "BPIT", font: { italic: true, color: { argb: "000080" }, bold: true, size: 14 } },
    { text: " Holdings CO.,LTD; www.bpit.co.th", font: { color: { argb: "000080" }, bold: true, size: 14 } }
  ]
};
sheet.getCell("E2").alignment = { horizontal: "left" };

// Cell E3

sheet.getCell("E3").value = "TIME RECORD REPORT";
sheet.getCell("E3").font = { bold: true, size: 12, color: { argb: "000080" },  underline: true  }; 
sheet.getCell("E3").alignment = { horizontal: "left" };

// Cell E4

sheet.getCell("E4").value = periodText;
sheet.getCell("E4").font = { bold: true, size: 12, color: { argb: "000080" } }; 
sheet.getCell("E4").alignment = { horizontal: "left" };


// Employee info
sheet.getCell("B6").value = {
  richText: [
    { text: "ชื่อ: ", font: { bold: true } }, 
    { text: emp.name }                       
  ]
};
sheet.getCell("B7").value = {
  richText: [
    { text: "ตำแหน่ง: ", font: { bold: true } },
    { text: emp.position || "-" }
  ]
};
sheet.getCell("E6").value = {
  richText: [
    { text: "รหัส: ", font: { bold: true } },
    { text: emp.em_code }
  ]
};
sheet.getCell("E7").value = {
  richText: [
    { text: "สังกัดลูกค้า: ", font: { bold: true } },
    { text: emp.company_name || selectedCompany }
  ]
};
 sheet.getCell("I6").value = `บริษัท:บีพีไอที โฮลดิ้งส์ จำกัด`;
 sheet.getCell("I6").font = { bold: true};
sheet.getCell("I7").value = {
  richText: [
    { text: "ชื่อหน่วยงานสังกัด: ", font: { bold: true } },
    { text: emp.department || "-" }
  ]
};

// สร้างหัวตาราง (2 แถว)
sheet.mergeCells('A9:A10'); // วัน
sheet.mergeCells('B9:B10'); // วัน/เดือน/ปี
sheet.mergeCells('C9:D9'); // เวลางานปกติ
sheet.mergeCells('E9:F9'); // OT ก่อนเริ่มงาน
sheet.mergeCells('G9:H9'); // OT หลังเลิกงาน
sheet.mergeCells('I9:I10'); // ชม.ทำงาน
sheet.mergeCells('J9:M9'); // ชม.OT
sheet.mergeCells('N9:N10'); // หมายเหตุ

// ตั้งค่าหัวแถวหลัก
sheet.getCell('A9').value = 'วัน';
sheet.getCell('B9').value = 'วัน/เดือน/ปี';
sheet.getCell('C9').value = 'เวลางานปกติ';
sheet.getCell('E9').value = 'OT ก่อนเริ่มงาน';
sheet.getCell('G9').value = 'OT หลังเลิกงาน';
sheet.getCell('I9').value = 'ชม.ทำงาน';
sheet.getCell('J9').value = 'ชม. OT';
sheet.getCell('N9').value = 'หมายเหตุ';

// ตั้งค่าหัวแถวรอง (แถว 2)
sheet.getCell('C10').value = 'เข้า';
sheet.getCell('D10').value = 'ออก';
sheet.getCell('E10').value = 'เข้า';
sheet.getCell('F10').value = 'ออก';
sheet.getCell('G10').value = 'เข้า';
sheet.getCell('H10').value = 'ออก';
sheet.getCell('J10').value = '1เท่า';
sheet.getCell('K10').value = '1.5เท่า';
sheet.getCell('L10').value = '2เท่า';
sheet.getCell('M10').value = '3เท่า';
sheet.getCell('N10').value = '(ป่วย/กิจ/พักร้อน)'; 

// จัดสไตล์หัวตาราง
['A9','B9','C9','E9','G9','I9','J9','N9',
 'C10','D10','E10','F10','G10','H10','J10','K10','L10','M10','N10'].forEach(cell => {

  sheet.getCell(cell).alignment = { vertical: 'middle', horizontal: 'center' };
  
  if(cell === 'N10') {
    sheet.getCell(cell).font = { color: { argb: 'FFFFFF' }, bold: true, size: 8 };
  } else {
    sheet.getCell(cell).font = { color: { argb: 'FFFFFF' }, bold: true }; 
  }

  sheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
  sheet.getCell(cell).border = { 
   top: {style:'thin'},
   left: {style:'thin'}, 
   bottom: {style:'thin'}, 
   right: {style:'thin'} };
});

// จัดความกว้างคอลัมน์
sheet.columns = [
  { key: 'day', width: 10 },
  { key: 'date', width: 12 },
  { key: 'in', width: 10 },
  { key: 'out', width: 10 },
  { key: 'ot_before_in', width: 12 },
  { key: 'ot_before_out', width: 12 },
  { key: 'ot_after_in', width: 12 },
  { key: 'ot_after_out', width: 12 },
  { key: 'work_hours', width: 10 },
  { key: 'ot_1', width: 10 },
  { key: 'ot_1_5', width: 10 },
  { key: 'ot_2', width: 10 },
  { key: 'ot_3', width: 10 },
  { key: 'note', width: 12 }
];
// Column width
sheet.columns = [
  { width: 10}, {width:12},
  {width:10}, {width:10},
  {width:12}, {width:12},
  {width:12}, {width:12},
  {width:10}, {width:10},
  {width:10}, {width:10},
  {width:10}, {width:12}
];

// Fill data
dayList.forEach((dateStr, idx) => {
  const key = `${emp.em_code}_${dateStr}`;
  const r = groupedRecords[key];
  if (!r) return;

  const row = sheet.addRow([
    dayNames[new Date(dateStr).getDay()],
    formatDateTH(dateStr), 
    r.checkIn, r.checkOut,
    r.otInBefore, r.otOutBefore,
    r.otInAfter, r.otOutAfter,
    calcDuration(r.checkIn, r.checkOut),
    "","","","",
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

const summaryRow = sheet.lastRow.number + 2;

// สรุป OT
sheet.mergeCells(`A${summaryRow}:I${summaryRow}`);
sheet.getCell(`A${summaryRow}`).value = "สรุป: OT 1 เท่า = ……...... ชม./ OT 1.5 เท่า = ……........ ชม./ OT 2 เท่า = ……......... ชม./ OT 3 เท่า = …............ ชม.";
sheet.getCell(`A${summaryRow}`).alignment = { horizontal: "left", vertical: "middle" };
sheet.getCell(`A${summaryRow}`).font = { bold: true };

sheet.mergeCells(`J${summaryRow}:N${summaryRow}`);
sheet.getCell(`J${summaryRow}`).value = "เบี้ยขยัน; (     ) ได้รับ     (     ) ไม่ได้";
sheet.getCell(`J${summaryRow}`).alignment = { horizontal: "left", vertical: "middle" };
sheet.getCell(`J${summaryRow}`).font = { bold: true };

sheet.getRow(summaryRow).height = 20;

// Footer เริ่มหลัง summaryRow
const footerStartRow = summaryRow + 2;

// Footer แถว 1-2 (เส้นสำหรับเซ็น)
for (let i = 0; i < 2; i++) {  // 2 บรรทัด
  const rowNum = footerStartRow + i;

  sheet.mergeCells(`B${rowNum}:C${rowNum}`);
  sheet.getCell(`B${rowNum}`).value = "...........................................";
  sheet.getCell(`B${rowNum}`).alignment = { vertical: 'bottom', horizontal: 'center' };

  sheet.mergeCells(`E${rowNum}:F${rowNum}`);
  sheet.getCell(`E${rowNum}`).value = "...........................................";
  sheet.getCell(`E${rowNum}`).alignment = { vertical: 'bottom', horizontal: 'center' };

  sheet.mergeCells(`H${rowNum}:I${rowNum}`);
  sheet.getCell(`H${rowNum}`).value = "...........................................";
  sheet.getCell(`H${rowNum}`).alignment = { vertical: 'bottom', horizontal: 'center' };

  sheet.getRow(rowNum).height = 18; // ความสูงแถว
}

// Footer แถวสำหรับชื่อผู้เซ็น (แถวที่ 3)
const nameRow = footerStartRow + 2;

sheet.mergeCells(`B${nameRow}:C${nameRow}`);
sheet.getCell(`B${nameRow}`).value = {
  richText: [
    { text: "เจ้าหน้าที่ ", font: { bold: true } },
    { text: "BPIT", font: { italic: true ,bold: true } }
  ]
};
sheet.getCell(`B${nameRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

sheet.mergeCells(`E${nameRow}:F${nameRow}`);
sheet.getCell(`E${nameRow}`).value = {
  richText: [{ text: "พนักงาน ", font: { bold: true } }]
};
sheet.getCell(`E${nameRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

sheet.mergeCells(`H${nameRow}:I${nameRow}`);
sheet.getCell(`H${nameRow}`).value = {
  richText: [{ text: "ผู้อนุมัติ(ลูกค้า) ", font: { bold: true } }]
};
sheet.getCell(`H${nameRow}`).alignment = { vertical: 'middle', horizontal: 'center' };


// Row height footer
for(let i=footerStartRow; i<=footerStartRow+3; i++) sheet.getRow(i).height = 25;

});

// Save file
const buf = await workbook.xlsx.writeBuffer();
saveAs(new Blob([buf]), `TimeRecords_${formatDateForApi(startDate)}_${formatDateForApi(endDate)}.xlsx`);
};

  if (!user) return null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">ตารางบันทึกการลงเวลา</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex flex-col">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>
        <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
          className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="all">เลือกบริษัท</option>
          {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex flex-col">
            <DatePicker
              selected={startDate}
              onChange={(date) => date && setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              dateFormat="dd/MM/yyyy"
              className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-col">
            <DatePicker
              selected={endDate}
              onChange={(date) => date && setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              dateFormat="dd/MM/yyyy"
              className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
         </div>
          <button onClick={exportExcel} className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition">
            ดาวน์โหลด Excel
          </button>
        </div>
      </div>
 
      {selectedCompany === "all" ? (
        <div className="text-red-500 font-semibold text-lg flex justify-center items-center">กรุณาเลือกบริษัทก่อนแสดงข้อมูล</div>
      ) : (<>
         {console.log(
      "tableData สำหรับแสดงตาราง:",
      Object.values(tableData).map(r => ({
        em_code: r.em_code,
        name: r.name,
        company_id: r.company_id,   // เพิ่มตรงนี้
        company_name: r.company      // และชื่อบริษัท
      }))
    )}
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
      </>
    )}
    </div>
  );
}