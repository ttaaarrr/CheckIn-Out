const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ฟังก์ชันคำนวณเวลา (ชั่วโมง + นาที + ชั่วโมงรวม)
function timeDiff(start, end) {
  const [sh, sm, ss] = start.split(':').map(Number);
  const [eh, em, es] = end.split(':').map(Number);
  let diffSec = (eh*3600 + em*60 + es) - (sh*3600 + sm*60 + ss);
  if (diffSec < 0) diffSec = 0;
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  return { hours, minutes, totalHours: diffSec/3600 };
}

// ฟังก์ชันคำนวณ OT
function calculateOT(records) {
  let otBefore = { hours: 0, minutes: 0, totalHours: 0 };
  let otAfter = { hours: 0, minutes: 0, totalHours: 0 };
  const otInBefore = records.find(r => r.type === 'ot_in_before')?.time;
  const otOutBefore = records.find(r => r.type === 'ot_out_before')?.time;
  const otInAfter = records.find(r => r.type === 'ot_in_after')?.time;
  const otOutAfter = records.find(r => r.type === 'ot_out_after')?.time;

  if (otInBefore && otOutBefore) otBefore = timeDiff(otInBefore, otOutBefore);
  if (otInAfter && otOutAfter) otAfter = timeDiff(otInAfter, otOutAfter);

  // รวม OT ก่อน + หลัง เป็น OT total
  const totalMinutes = Math.round((otBefore.totalHours + otAfter.totalHours) * 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  return {
    otBefore: otBefore.hours + 'ชม. ' + otBefore.minutes + 'นาที',
    otAfter: otAfter.hours + 'ชม. ' + otAfter.minutes + 'นาที',
    otTotal: totalHours + 'ชม. ' + totalMins + 'นาที'  // รวมก่อน+หลัง
  };
}

// POST บันทึกเวลา พร้อม GPS
router.post('/', async (req, res) => {
  const { empId, type, company_name, latitude, longitude } = req.body;
  const conn = await pool.getConnection();

  try {
    const today = new Date().toISOString().slice(0, 10);

    const validTypes = ['in','out','ot_in_before','ot_in_after','ot_out_before','ot_out_after'];
    if (!validTypes.includes(type)) {
      return res.json({ success: false, message: `Type ไม่ถูกต้อง: ${type}` });
    }

    if (!latitude || !longitude) {
      return res.json({ success: false, message: 'ต้องเปิด GPS ก่อนลงเวลา' });
    }

    const [companyRow] = await conn.query(
      'SELECT latitude AS lat, longitude AS lng, radius_km FROM company WHERE name = ?',
      [company_name]
    );
    if (companyRow.length === 0) {
      return res.json({ success: false, message: 'ไม่พบบริษัท' });
    }

    const companyLat = companyRow[0].lat;
    const companyLng = companyRow[0].lng;
    const radiusKm = companyRow[0].radius_km || 0.5;

    // ตรวจระยะทาง
    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R*c;
    }

    const distance = getDistanceFromLatLonInKm(latitude, longitude, companyLat, companyLng);
    if (distance > radiusKm) {
      return res.json({ success: false, message: 'คุณอยู่นอกพื้นที่บริษัท' });
    }

    // ตรวจ record ซ้ำ
    const [records] = await conn.query(
      'SELECT type FROM time_records WHERE em_code = ? AND date = ? AND company_name = ?',
      [empId, today, company_name]
    );

    // ฟังก์ชันตรวจลงเวลา
    function validateOT(type, records) {
      const types = records.map(r => r.type);

      if (type === 'in') {
        if (types.includes('ot_in_before') && !types.includes('ot_out_before')) {
          return 'คุณต้องบันทึกเวลาออก OT ก่อนเข้างานก่อนถึงจะลงเวลาเข้าทำงานปกติได้';
        }
      }

      if (type === 'out' && !types.includes('in')) {
        return 'คุณยังไม่ได้ลงเวลาเข้างาน ไม่สามารถลงเวลาออกงานได้';
      }

      if (types.includes(type)) {
        return `คุณได้บันทึก "${type}" ไปแล้ววันนี้`;
      }

      // ตรวจ OT
      if (type === 'ot_in_before' && types.includes('in')) {
        return 'ไม่สามารถบันทึก OT ก่อนเข้างานได้ เนื่องจากมีการลงเวลาเข้าทำงานแล้ว';
      }
      if (type === 'ot_in_after') {
        if (!types.includes('out')) return 'คุณยังไม่ได้ลงเวลาออกปกติ';
        if (types.includes('ot_in_before') && !types.includes('ot_out_before')) {
          return 'คุณยังไม่ได้ลงเวลาออก OT ก่อนเข้างาน';
        }
      }
      if (type === 'ot_out_before') {
        if (!types.includes('ot_in_before')) return 'คุณยังไม่ได้บันทึกเวลาเข้า OT ก่อนเข้างาน';
      }
      if (type === 'ot_out_after') {
        if (!types.includes('ot_in_after')) return 'คุณยังไม่ได้บันทึกเวลาเข้า OT หลังเลิกงาน';
      }

      return null;
    }

    const otError = validateOT(type, records);
    if (otError) {
      return res.json({ success: false, message: otError });
    }

    // insert record
    const [result] = await conn.query(
      'INSERT INTO time_records (em_code, type, time, date, company_name, latitude, longitude) VALUES (?, ?, CURTIME(), CURDATE(), ?, ?, ?)',
      [empId, type, company_name, latitude, longitude]
    );

    const [rows] = await conn.query('SELECT time FROM time_records WHERE id = ?', [result.insertId]);

    res.json({ success: true, message: `บันทึกเวลา ${type} สำเร็จ`, time: rows[0].time });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  } finally {
    conn.release();
  }
});

// ประวัติพนักงาน
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ success: false, message: 'ต้องระบุวันที่' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT t.id, t.em_code, t.type, t.time, t.date, t.company_name, t.latitude, t.longitude, e.name
       FROM time_records t
       LEFT JOIN employees e ON t.em_code = e.em_code
       WHERE t.date = ?
       ORDER BY t.em_code, t.type`,
      [date]
    );
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Database error' });
  } finally {
    conn.release();
  }
});

// รายเดือน
router.get('/monthly', async (req, res) => {
  const { month, company } = req.query;
  const conn = await pool.getConnection();
  try {
    let sql = `
      SELECT tr.em_code, tr.company_name, tr.date, tr.type, tr.time, e.name
      FROM time_records tr
      JOIN employees e ON tr.em_code = e.em_code
      WHERE DATE_FORMAT(tr.date, '%Y-%m') = ?
    `;
    const params = [month];
    if (company && company !== 'all') {
      sql += ' AND tr.company_name = ?';
      params.push(company);
    }
    const [rows] = await conn.query(sql, params);
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Database error' });
  } finally {
    conn.release();
  }
});

// เลือกเวลาแบบช่วง
router.get('/range', authMiddleware, async (req, res) => {
  const { start, end, company } = req.query;
  if (!start || !end || !company) 
    return res.status(400).json({ success: false, message: 'Missing parameters' });

  const { role, id } = req.user; // ดึง role + id จาก JWT

  const conn = await pool.getConnection();
  try {
    let sql = `
      SELECT tr.em_code, tr.company_name, tr.date, tr.type, tr.time, e.name
      FROM time_records tr
      LEFT JOIN employees e ON tr.em_code = e.em_code
      WHERE tr.date BETWEEN ? AND ?
    `;
    const params = [start, end];

    if (role === 'manager') {
      // manager เห็นแค่บริษัทที่ตัวเองเพิ่ม
      sql += ' AND tr.company_name IN (SELECT name FROM company WHERE added_by = ?)';
      params.push(id);
    } else if (company !== 'all') {
      // admin เลือกเฉพาะบริษัทถ้าไม่ได้เลือก all
      sql += ' AND tr.company_name = ?';
      params.push(company);
    }

    const [rows] = await conn.query(sql, params);

    // แปลงข้อมูลเป็น structured object ต่อคนต่อวัน
    const recordsByEmp = {};
    rows.forEach(r => {
      if (!recordsByEmp[r.em_code]) recordsByEmp[r.em_code] = { records: [] };
      recordsByEmp[r.em_code].records.push(r);
    });

    const result = Object.entries(recordsByEmp).map(([empId, data]) => {
      const { otBefore, otAfter, otTotal } = calculateOT(data.records);

      const inTime = data.records.find(r => r.type === 'in')?.time || null;
      const outTime = data.records.find(r => r.type === 'out')?.time || null;

      let workHours = { hours: 0, minutes: 0 };
      if (inTime && outTime) {
        const diff = timeDiff(inTime, outTime);
        workHours = { hours: diff.hours, minutes: diff.minutes };
      }

      return {
        empId,
        name: data.records[0].name,
        inTime,
        outTime,
        otInBefore: data.records.find(r => r.type === 'ot_in_before')?.time || null,
        otOutBefore: data.records.find(r => r.type === 'ot_out_before')?.time || null,
        otInAfter: data.records.find(r => r.type === 'ot_in_after')?.time || null,
        otOutAfter: data.records.find(r => r.type === 'ot_out_after')?.time || null,
        workHours: workHours.hours + 'ชม. ' + workHours.minutes + 'นาที',
        otBefore,
        otAfter,
        otTotal
      };
    });

    res.json({ success: true, records: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    conn.release();
  }
});


module.exports = router;
