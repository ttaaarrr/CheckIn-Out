const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post('/', async (req, res) => {
  const { empId, company_name, date, start_time, end_time, reason } = req.body;
  const conn = await pool.getConnection();

  try {
    if (!empId || !company_name || !date || !start_time || !end_time || !reason) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }

    // ตรวจพนักงานว่ามีจริง
    const [empRows] = await conn.query(
      'SELECT * FROM employees WHERE em_code = ? AND company_name = ?',
      [empId, company_name]
    );
    if (empRows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบพนักงาน' });
    }

    // บันทึก OT request
    await conn.query(
      `INSERT INTO ot_requests (emp_code, company_name, date, start_time, end_time, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [empId, company_name, date, start_time, end_time, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/ot-request error:', err.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

module.exports = router;