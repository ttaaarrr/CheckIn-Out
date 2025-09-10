const express = require('express');
const pool = require('../db'); // import pool
const router = express.Router();

// เพิ่มพนักงาน
router.post('/', async (req, res) => {
  try {
    const { em_code, name, position, department, company_name } = req.body;
    if (!em_code || !name || !position || !department || !company_name) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // เช็ครหัสซ้ำในบริษัทเดียวกัน
    const [existing] = await pool.execute(
      'SELECT id FROM employees WHERE em_code = ? AND company_name = ?',
      [em_code, company_name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'รหัสพนักงานซ้ำในบริษัทนี้' });
    }

    await pool.execute(
      'INSERT INTO employees (em_code, name, position, department, company_name) VALUES (?, ?, ?, ?, ?)',
      [em_code, name, position, department, company_name]
    );

    res.json({ success: true, message: 'เพิ่มพนักงานเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
router.get('/', async (req, res) => {
  try {
    const { company_name } = req.query;

    let sql = 'SELECT id, em_code, name, position, department, company_name FROM employees';
    let params = [];

    if (company_name) {
      sql += ' WHERE company_name = ?';
      params.push(company_name);
    }

    const [employees] = await pool.execute(sql, params);

    res.json({ success: true, employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// ลบพนักงาน
router.delete('/:em_code', async (req, res) => {
  try {
    const { em_code } = req.params;
    const { company_name } = req.query;
    if (!company_name) return res.status(400).json({ success: false, message: 'Missing company_name' });

    await pool.execute('DELETE FROM employees WHERE em_code= ? AND company_name = ?', [em_code, company_name]);
    res.json({ success: true, message: 'ลบพนักงานเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// ตรวจสอบรหัสพนักงานอยู่ในบริษัทหรือไม่
router.get('/check/:empId/:company_name', async (req, res) => {
  const { empId, company_name } = req.params;
  if (!empId || !company_name) return res.status(400).json({ success:false, message:'Missing parameters' });

  try {
    const [rows] = await pool.execute('SELECT id FROM employees WHERE id = ? AND company_name = ?', [empId, company_name]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
