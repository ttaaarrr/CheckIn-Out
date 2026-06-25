import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from '../src/api';

const timeToMinutes = (t) => {
  if (!t || t === "-") return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ✅ FIX 1: normalize ชื่อบริษัทให้ตรงกัน (ตัดช่องว่างหัวท้าย + ลด whitespace ซ้ำ)
const normalizeName = (name) =>
  (name || "").replace(/\s+/g, " ").trim().toLowerCase();

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

  // mapping ชื่อเก่า -> ชื่อใหม่
  const companyNameMap = {
    "บริษัทเก่า": "ชื่อใหม่",
    "OldCo": "NewCo"
  };

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Fetch employees
  useEffect(() => {
    if (!user) return;

    const fetchCompaniesAndEmployees = async () => {
      try {
        const compRes = await api.get("https://api-checkin-out.bpit-staff.com/api/company");
        if (!compRes.data.success) return;

        const companyList = compRes.data.companies.map((c, index) => ({
          id: index,
          name: c.name,
          time_in: c.time_in,
          time_out: c.timeout
        }));

        setCompanies(companyList);

        // ✅ FIX 2: ใช้ normalizeName ใน companyMap
        const companyMap = {};
        companyList.forEach(c => {
          companyMap[normalizeName(c.name)] = c.id;
        });

        // ✅ FIX 3: encodeURIComponent ชื่อบริษัทใน URL
        const url =
          selectedCompany === "all"
            ? "https://api-checkin-out.bpit-staff.com/api/employees?company_name=A"
            : `https://api-checkin-out.bpit-staff.com/api/employees?company_name=${encodeURIComponent(selectedCompany)}`;

        const empRes = await api.get(url);
        if (!empRes.data.success) return;

        const employeesWithId = empRes.data.employees.map(emp => {
          const normalizedName = companyNameMap[emp.company_name?.trim()] || emp.company_name?.trim();
          return {
            ...emp,
            company_id: companyMap[normalizeName(normalizedName)] ?? null,
            company_name: normalizedName
          };
        });

        setEmployees(employeesWithId);

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
        const compRes = await api.get("https://api-checkin-out.bpit-staff.com/api/company");
        if (compRes.data.success) {
          setCompanies(
            compRes.data.companies.map((c, index) => ({
              id: index,
              name: c.name,
              time_in: c.time_in,
              time_out: c.time_out
            }))
          );
        }

        // ✅ FIX 3: encodeURIComponent ในส่วนนี้ด้วย
        const recRes = await api.get(
          `https://api-checkin-out.bpit-staff.com/api/time-record?date=${formatDateForApi(selectedDate)}${
            selectedCompany !== "all" ? `&company=${encodeURIComponent(selectedCompany)}` : ""
          }`
        );
        if (recRes.data.success) setRecords(recRes.data.records || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user, selectedDate, selectedCompany]);

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
    if (selectedCompany !== "all" && r.company_name !== selectedCompany) return;

    const key = `${r.em_code}_${r.company_name}_${getLocalDateStr(selectedDate)}`;
    if (!tableData[key]) {
      // ✅ FIX 4: ใช้ normalizeName เพื่อ match บริษัท
      const emp = employees.find(
        e => e.em_code.toString() === r.em_code.toString() &&
          normalizeName(e.company_name) === normalizeName(r.company_name)
      );

      if (!emp) console.log("NOT FOUND", r);

      tableData[key] = {
        em_code: r.em_code,
        name: emp?.name || r.name || "-",
        company_id: emp?.company_id ?? null,
        company: emp?.company_name || r.company_name || selectedCompany,
        checkIn: "-",
        checkOut: "-",
        otInBefore: "-",
        otOutBefore: "-",
        otInAfter: "-",
        otOutAfter: "-",
        lateMinutes: "-",
        note: "-",
      };
    }
    const field = typeMap[r.type.toLowerCase()];
    if (field) tableData[key][field] = r.time || "-";
    if (r.note) tableData[key].note = r.note;
    if (field === "checkIn") {
      // ✅ FIX 4: ใช้ normalizeName เพื่อ match บริษัท
      const company = companies.find(
        c => normalizeName(c.name) === normalizeName(tableData[key].company)
      );

      if (company?.time_in && tableData[key].checkIn !== "-") {
        const checkInMin = timeToMinutes(tableData[key].checkIn);
        const workStart = timeToMinutes(company.time_in);

        if (checkInMin !== null && workStart !== null && checkInMin > workStart) {
          tableData[key].lateMinutes = checkInMin - workStart;
        } else {
          tableData[key].lateMinutes = "-";
        }
      }
    }
  });

  const exportExcel = async () => {
    if (!selectedCompany || selectedCompany === "all" || !startDate || !endDate) {
      alert("กรุณาเลือกบริษัทและช่วงวันที่ก่อน export Excel");
      return;
    }

    const dayList = [];
    if (startDate && endDate) {
      const current = new Date(startDate);
      const last = new Date(endDate);
      while (current <= last) {
        dayList.push(formatDateForApi(current));
        current.setDate(current.getDate() + 1);
      }
    }

    let dailyRows = [];
    try {
      // ✅ FIX 3: encodeURIComponent ในทุก URL ของ exportExcel
      const requests = dayList.map(dateStr => {
        const url = `https://api-checkin-out.bpit-staff.com/api/time-record?date=${dateStr}&company=${encodeURIComponent(selectedCompany)}`;
        console.log("Fetching URL:", url);
        return api.get(url).then(res => ({ dateStr, data: res.data }));
      });

      const responses = await Promise.all(requests);
      responses.forEach(({ dateStr, data }) => {
        if (data && data.success && Array.isArray(data.records)) {
          data.records.forEach(r => {
            dailyRows.push({ ...r, date: dateStr });
          });
        }
      });

      dailyRows.forEach(r => {
        if (r.em_code !== undefined && r.em_code !== null)
          r.em_code = r.em_code.toString();
      });
      employees.forEach(e => {
        if (e.em_code !== undefined && e.em_code !== null)
          e.em_code = e.em_code.toString();
      });

      // ✅ DEBUG LOG
      console.log("dailyRows count:", dailyRows.length);
      console.log("dailyRows sample:", dailyRows.slice(0, 3));

    } catch (err) {
      console.error(err);
      return;
    }

    let empList = employees;
    if (!empList.length) {
      try {
        // ✅ FIX 3: encodeURIComponent ที่นี่ด้วย
        const empRes = await api.get(
          `https://api-checkin-out.bpit-staff.com/api/employees?company_name=${encodeURIComponent(selectedCompany)}`
        );
        if (empRes.data.success) empList = empRes.data.employees || [];
      } catch (err) {
        console.error(err);
        alert("ไม่สามารถดึงข้อมูลพนักงานได้");
        return;
      }
    }

    empList.forEach(e => {
      if (e && e.em_code !== undefined && e.em_code !== null)
        e.em_code = e.em_code.toString();
    });

    // ✅ DEBUG LOG
    console.log("empList count:", empList.length);
    console.log("empList sample:", empList.slice(0, 3).map(e => ({ em_code: e.em_code, company_name: e.company_name })));

    // ✅ DEBUG LOG: ตรวจ matching
    const unmatchedRows = dailyRows.filter(r =>
      !empList.find(
        e => e.em_code === r.em_code.toString() &&
          normalizeName(e.company_name) === normalizeName(r.company_name)
      )
    );
    if (unmatchedRows.length > 0) {
      console.warn("⚠️ Unmatched records:", unmatchedRows.slice(0, 5));
      console.warn("company_name จาก record:", [...new Set(unmatchedRows.map(r => r.company_name))]);
      console.warn("company_name จาก empList:", [...new Set(empList.map(e => e.company_name))]);
    }

    const groupedRecords = {};
    empList.forEach((emp) => {
      dayList.forEach((dateStr) => {
        // ✅ FIX 4: ใช้ normalizeName ใน key
        const key = `${emp.em_code}_${normalizeName(emp.company_name)}_${dateStr}`;
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

    // ✅ FIX 4: ใช้ normalizeName ในการ match และ key
    dailyRows.forEach((r) => {
      const emp = empList.find(
        e => e.em_code.toString() === r.em_code.toString() &&
          normalizeName(e.company_name) === normalizeName(r.company_name)
      );
      if (!emp) return;

      const dateStr = r.date;
      const key = `${emp.em_code}_${normalizeName(emp.company_name)}_${dateStr}`;
      if (!groupedRecords[key]) return;

      const type = (r.type || '').toLowerCase();
      const newTime = r.time || '-';

      const shouldUpdate = (field) => {
        const existing = groupedRecords[key][field];
        if (!existing || existing === '-') return true;
        if (!newTime || newTime === '-') return false;
        const existingMin = timeToMinutes(existing);
        const newMin = timeToMinutes(newTime);
        if (existingMin === null || newMin === null) return false;
        const isOutType = field === 'checkOut' || field === 'otOutBefore' || field === 'otOutAfter';
        return isOutType ? newMin > existingMin : newMin < existingMin;
      };

      if (type === 'in' && shouldUpdate('checkIn')) groupedRecords[key].checkIn = newTime;
      else if (type === 'out' && shouldUpdate('checkOut')) groupedRecords[key].checkOut = newTime;
      else if (type === 'ot_in_before' && shouldUpdate('otInBefore')) groupedRecords[key].otInBefore = newTime;
      else if (type === 'ot_out_before' && shouldUpdate('otOutBefore')) groupedRecords[key].otOutBefore = newTime;
      else if (type === 'ot_in_after' && shouldUpdate('otInAfter')) groupedRecords[key].otInAfter = newTime;
      else if (type === 'ot_out_after' && shouldUpdate('otOutAfter')) groupedRecords[key].otOutAfter = newTime;

      if (r.note) groupedRecords[key].note = r.note;
    });

    // สร้าง Excel
    const workbook = new ExcelJS.Workbook();
    const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

    const formatDateTH = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d)) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

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

      sheet.addImage(logoLeftId, {
        tl: { col: 1, row: 0 },
        br: { col: 3, row: 4 },
        editAs: 'oneCell'
      });

      sheet.pageSetup = {
        paperSize: 9,
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

      sheet.getCell("E2").value = {
        richText: [
          { text: "BPIT", font: { italic: true, color: { argb: "000080" }, bold: true, size: 14 } },
          { text: " Holdings CO.,LTD; www.bpit.co.th", font: { color: { argb: "000080" }, bold: true, size: 14 } }
        ]
      };
      sheet.getCell("E2").alignment = { horizontal: "left" };

      sheet.getCell("E3").value = "TIME RECORD REPORT";
      sheet.getCell("E3").font = { bold: true, size: 12, color: { argb: "000080" }, underline: true };
      sheet.getCell("E3").alignment = { horizontal: "left" };

      sheet.getCell("E4").value = periodText;
      sheet.getCell("E4").font = { bold: true, size: 12, color: { argb: "000080" } };
      sheet.getCell("E4").alignment = { horizontal: "left" };

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
      sheet.getCell("I6").font = { bold: true };
      sheet.getCell("I7").value = {
        richText: [
          { text: "ชื่อหน่วยงานสังกัด: ", font: { bold: true } },
          { text: emp.department || "-" }
        ]
      };

      sheet.mergeCells('A9:A10');
      sheet.mergeCells('B9:B10');
      sheet.mergeCells('C9:D9');
      sheet.mergeCells('E9:F9');
      sheet.mergeCells('G9:H9');
      sheet.mergeCells('I9:I10');
      sheet.mergeCells('J9:J10');
      sheet.mergeCells('K9:N9');
      sheet.mergeCells('O9');

      sheet.getCell('A9').value = 'วัน';
      sheet.getCell('B9').value = 'วัน/เดือน/ปี';
      sheet.getCell('C9').value = 'เวลางานปกติ';
      sheet.getCell('E9').value = 'OT ก่อนเริ่มงาน';
      sheet.getCell('G9').value = 'OT หลังเลิกงาน';
      sheet.getCell('I9').value = 'ชม.ทำงาน';
      sheet.getCell('J9').value = 'สาย (นาที)';
      sheet.getCell('K9').value = 'ชม. OT';
      sheet.getCell('O9').value = 'หมายเหตุ';

      sheet.getCell('C10').value = 'เข้า';
      sheet.getCell('D10').value = 'ออก';
      sheet.getCell('E10').value = 'เข้า';
      sheet.getCell('F10').value = 'ออก';
      sheet.getCell('G10').value = 'เข้า';
      sheet.getCell('H10').value = 'ออก';
      sheet.getCell('K10').value = '1เท่า';
      sheet.getCell('L10').value = '1.5เท่า';
      sheet.getCell('M10').value = '2เท่า';
      sheet.getCell('N10').value = '3เท่า';
      sheet.getCell('O10').value = '(ป่วย/กิจ/พักร้อน)';

      ['A9', 'B9', 'C9', 'E9', 'G9', 'I9', 'J9', 'K9', 'O9',
        'C10', 'D10', 'E10', 'F10', 'G10', 'H10', 'K10', 'L10', 'M10', 'N10', 'O10'].forEach(cell => {
        sheet.getCell(cell).alignment = { vertical: 'middle', horizontal: 'center' };
        if (cell === 'O10') {
          sheet.getCell(cell).font = { color: { argb: 'FFFFFF' }, bold: true, size: 8 };
        } else {
          sheet.getCell(cell).font = { color: { argb: 'FFFFFF' }, bold: true };
        }
        sheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
        sheet.getCell(cell).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      sheet.columns = [
        { width: 10 }, { width: 12 }, { width: 10 },
        { width: 10 }, { width: 12 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 10 },
        { width: 10 }, { width: 10 }, { width: 10 },
        { width: 10 }, { width: 10 }, { width: 12 }
      ];

      // ✅ FIX 4: ใช้ normalizeName ใน key ตอน fill data
      dayList.forEach((dateStr) => {
        const key = `${emp.em_code}_${normalizeName(emp.company_name)}_${dateStr}`;
        const r = groupedRecords[key];
        if (!r) return;

        let lateMinutes = "";

        // ✅ FIX 4: ใช้ normalizeName ในการ find บริษัท
        const company = companies.find(
          c => normalizeName(c.name) === normalizeName(r.company_name)
        );

        let checkInMin = null;
        let checkOutMin = null;
        let workStart = null;
        let workEnd = null;

        if (company) {
          checkInMin = timeToMinutes(r.checkIn);
          checkOutMin = timeToMinutes(r.checkOut);
          workStart = timeToMinutes(company.time_in);
          workEnd = timeToMinutes(company.time_out);

          if (checkInMin !== null && workStart !== null && checkInMin > workStart) {
            lateMinutes = checkInMin - workStart;
          }
        }

        lateMinutes = lateMinutes === "" ? "-" : lateMinutes;

        const row = sheet.addRow([
          dayNames[new Date(dateStr).getDay()],
          formatDateTH(dateStr),
          r.checkIn,
          r.checkOut,
          r.otInBefore,
          r.otOutBefore,
          r.otInAfter,
          r.otOutAfter,
          calcDuration(r.checkIn, r.checkOut),
          lateMinutes || "",
          "", "", "", "",
          r.note || ""
        ]);

        row.eachCell({ includeEmpty: true }, cell => {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });

        if (checkInMin !== null && workStart !== null && checkInMin > workStart) {
          row.getCell(3).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" }
          };
        }

        if (checkOutMin !== null && workEnd !== null && checkOutMin < workEnd) {
          row.getCell(4).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" }
          };
        }

        const day = new Date(dateStr).getDay();
        if (day === 0 || day === 6) {
          row.eachCell({ includeEmpty: true }, cell => {
            cell.fill = {
              type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" }
            };
          });
        }

        row.height = 18;
      });

      const summaryRow = sheet.lastRow.number + 2;
      sheet.mergeCells(`A${summaryRow}:I${summaryRow}`);
      sheet.getCell(`A${summaryRow}`).value = "สรุป: OT 1 เท่า = ……...... ชม./ OT 1.5 เท่า = ……........ ชม./ OT 2 เท่า = ……......... ชม./ OT 3 เท่า = …............ ชม.";
      sheet.getCell(`A${summaryRow}`).alignment = { horizontal: "left", vertical: "middle" };
      sheet.getCell(`A${summaryRow}`).font = { bold: true };

      sheet.mergeCells(`J${summaryRow}:N${summaryRow}`);
      sheet.getCell(`J${summaryRow}`).value = "เบี้ยขยัน; (     ) ได้รับ     (     ) ไม่ได้";
      sheet.getCell(`J${summaryRow}`).alignment = { horizontal: "left", vertical: "middle" };
      sheet.getCell(`J${summaryRow}`).font = { bold: true };

      sheet.getRow(summaryRow).height = 20;

      const footerStartRow = summaryRow + 2;

      for (let i = 0; i < 2; i++) {
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

        sheet.getRow(rowNum).height = 18;
      }

      const nameRow = footerStartRow + 2;

      sheet.mergeCells(`B${nameRow}:C${nameRow}`);
      sheet.getCell(`B${nameRow}`).value = {
        richText: [
          { text: "เจ้าหน้าที่ ", font: { bold: true } },
          { text: "BPIT", font: { italic: true, bold: true } }
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

      for (let i = footerStartRow; i <= footerStartRow + 3; i++) sheet.getRow(i).height = 25;
    });

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `TimeRecords_${formatDateForApi(startDate)}_${formatDateForApi(endDate)}.xlsx`);
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 min-h-screen">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800">
        ตารางบันทึกการลงเวลา
      </h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex flex-col w-full md:w-auto">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            className="w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>

        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="w-full md:w-auto px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="all">เลือกบริษัท</option>
          {companies.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        <div className="flex flex-col sm:flex-row items-center gap-2 md:ml-auto w-full md:w-auto">
          <DatePicker
            selected={startDate}
            onChange={(date) => date && setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            dateFormat="dd/MM/yyyy"
            className="w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />

          <DatePicker
            selected={endDate}
            onChange={(date) => date && setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate}
            dateFormat="dd/MM/yyyy"
            className="w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />

          <button
            onClick={exportExcel}
            className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
          >
            ดาวน์โหลด Excel
          </button>
        </div>
      </div>

      {selectedCompany === "all" ? (
        <div className="text-red-500 font-semibold text-lg flex justify-center items-center">
          กรุณาเลือกบริษัทก่อนแสดงข้อมูล
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-max border border-gray-300 border-collapse text-sm mx-auto">
              <thead className="bg-blue-50">
                <tr>
                  <th rowSpan={2} className="border px-2 py-1">รหัสพนักงาน</th>
                  <th rowSpan={2} className="border px-2 py-1">ชื่อ</th>
                  <th rowSpan={2} className="border px-2 py-1">เวลาเข้า</th>
                  <th rowSpan={2} className="border px-2 py-1">เวลาออก</th>
                  <th colSpan={4} className="border px-2 py-1 text-center">OT</th>
                  <th rowSpan={2} className="border px-2 py-1">ชั่วโมงทำงาน</th>
                  <th rowSpan={2} className="border px-2 py-1">ชั่วโมง OT</th>
                  <th rowSpan={2} className="border px-2 py-1">สาย (นาที)</th>
                  <th rowSpan={2} className="border px-2 py-1">หมายเหตุ</th>
                </tr>
                <tr>
                  <th className="border px-2 py-1">OT IN (ก่อนเข้างาน)</th>
                  <th className="border px-2 py-1">OT OUT (ก่อนเข้างาน)</th>
                  <th className="border px-2 py-1">OT IN (หลังเลิกงาน)</th>
                  <th className="border px-2 py-1">OT OUT (หลังเลิกงาน)</th>
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
                    <td className="border px-2 py-1">{r.lateMinutes}</td>
                    <td className="border px-2 py-1">{r.note || "-"}</td>
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
