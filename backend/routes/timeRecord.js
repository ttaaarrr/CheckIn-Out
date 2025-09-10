const express = require('express');
const pool = require('../db');
const router = express.Router();

// --- POST บันทึกเวลา พร้อม GPS ---
router.post('/', async (req, res) => {
  const { empId, type, company_name, latitude, longitude } = req.body;
  const conn = await pool.getConnection();

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (!['in','out','ot_in','ot_out'].includes(type)) {
      return res.status(400).json({ success: false, message: `Type ไม่ถูกต้อง: ${type}` });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'ต้องเปิด GPS ก่อนลงเวลา' });
    }

    // ดึงพิกัดบริษัท
    const [companyRow] = await conn.query(
      'SELECT latitude AS lat, longitude AS lng, radius_km FROM company WHERE name = ?',
      [company_name]
    );
    if (companyRow.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบบริษัท' });
    }
    const companyLat = companyRow[0].lat;
    const companyLng = companyRow[0].lng;
    const radiusKm = companyRow[0].radius_km || 0.5;

    // ฟังก์ชันคำนวณระยะทาง
    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
      const R = 6371; // km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const distance = getDistanceFromLatLonInKm(latitude, longitude, companyLat, companyLng);
    if (distance > radiusKm) {
      return res.status(400).json({ success: false, message: 'คุณอยู่นอกพื้นที่บริษัท' });
    }

    // ตรวจ record ซ้ำ
    const [records] = await conn.query(
      'SELECT type FROM time_records WHERE em_code = ? AND date = ? AND company_name = ?',
      [empId, today, company_name]
    );

    if (records.some(r => r.type === type)) {
      return res.status(400).json({ success: false, message: `คุณได้บันทึก "${type}" ไปแล้ววันนี้` });
    }

    if ((type === 'out' || type === 'ot_in' || type === 'ot_out') &&
        !records.some(r => r.type === 'in')) {
      return res.status(400).json({
        success: false,
        message: 'ต้องลงเวลาเข้า ("in") ก่อนจึงจะลงเวลาออกหรือ OT ได้'
      });
    }

    // insert record พร้อม GPS
    const [result] = await conn.query(
      'INSERT INTO time_records (em_code, type, time, date, company_name, latitude, longitude) VALUES (?, ?, CURTIME(), CURDATE(), ?, ?, ?)',
      [empId, type, company_name, latitude, longitude]
    );

    const [rows] = await conn.query('SELECT time FROM time_records WHERE id = ?', [result.insertId]);

    res.json({ success: true, message: 'บันทึกเวลาเรียบร้อย', time: rows[0].time });
  } catch (err) {
    console.error('POST /api/time-record error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// --- GET ประวัติพนักงาน ---
router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ success: false, message: 'ต้องระบุวันที่' });

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
    console.error('GET /api/time-record error:', err.message);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    conn.release();
  }
});
//รายเดือน
router.get('/monthly', async (req, res) => {
  const { month, company } = req.query; // month="2025-09"
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
    console.error('GET /api/time-record/monthly error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;