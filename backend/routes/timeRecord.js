const express = require('express');
const pool = require('../db');
const router = express.Router();

//  บันทึกเวลา พร้อม GPS
router.post('/', async (req, res) => {
  const { empId, type, company_name, latitude, longitude } = req.body;
  const conn = await pool.getConnection();

  try {
    const today = new Date().toISOString().slice(0, 10);

    // ตรวจ type
    const validTypes = ['in','out','ot_in_before','ot_in_after','ot_out_before','ot_out_after'];
    if (!validTypes.includes(type)) {
      return res.json({ success: false, message: `Type ไม่ถูกต้อง: ${type}` });
    }

    if (!latitude || !longitude) {
      return res.json({ success: false, message: 'ต้องเปิด GPS ก่อนลงเวลา' });
    }

    // ดึงพิกัดบริษัท
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
    //ฟังก์ชันตรวจลงเวลา
    function validateOT(type, records) {
      const types = records.map(r => r.type);
      
      //  เช็คการเข้า/ออกงานปกติ
  if (type === 'in') {
    if (types.includes('ot_in_before') && !types.includes('ot_out_before')) {
      return 'คุณต้องบันทึกเวลาออก OT ก่อนเข้างานก่อนถึงจะลงเวลาเข้าทำงานปกติได้';
    }
  }
    if (type === 'out' && !records.some(r => r.type === 'in')) {
  return res.json({ success: false, message: 'คุณยังไม่ได้ลงเวลาเข้างาน ไม่สามารถลงเวลาออกงานได้' });
}
    if (records.some(r => r.type === type)) {
      return res.json({ success: false, message: `คุณได้บันทึก "${type}" ไปแล้ววันนี้` });
    }
// เช็คOT
      if (type === 'ot_in_before' && types.includes('in')) {
        return 'ไม่สามารถบันทึก OT ก่อนเข้างานได้ เนื่องจากมีการลงเวลาเข้าทำงานแล้ว';
      }
      if (type === 'ot_in_after') {
        if (!types.includes('out')) return 'คุณยังไม่ได้ลงเวลาออกปกติ ';
        if (types.includes('ot_in_before') && !types.includes('ot_out_before'))
          return ' คุณยังไม่ได้ลงเวลาออก OT ก่อนเข้างาน';
      }
      if (type === 'ot_out_before') {
        if (!types.includes('ot_in_before')) return 'คุณยังไม่ได้บันทึกเวลาเข้า OT ก่อนเข้างาน';
        }
      if (type === 'ot_out_after') {
        if (!types.includes('ot_in_after')) return 'คุณยังไม่ได้บันทึกเวลาเข้า OT หลังเลิกงาน ';
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

//  รายเดือน 
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
// เลือกเวลา
router.get('/range', async (req, res) => {
  const { start, end, company } = req.query;
  if (!start || !end || !company) return res.status(400).json({ success: false, message: 'Missing parameters' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT tr.em_code, tr.company_name, tr.date, tr.type, tr.time, e.name
       FROM time_records tr
       LEFT JOIN employees e ON tr.em_code = e.em_code
       WHERE tr.company_name = ? AND tr.date BETWEEN ? AND ?
       ORDER BY tr.em_code, tr.date, tr.type`,
      [company, start, end]
    );

    res.json({ success: true, records: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    conn.release();
  }
});
module.exports = router;
