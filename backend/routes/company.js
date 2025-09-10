const express = require('express');
const pool = require('../db'); 
const router = express.Router();

// ดึงรายชื่อบริษัท
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT name, address, latitude, longitude FROM company');
    console.log('DB rows:', rows); // log ดูว่ามีข้อมูลไหม
    res.json({ success: true, companies: rows });
  } catch (err) {
    console.error('GET /api/company error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    if (conn) conn.release();
  }
});

// เพิ่มบริษัท
router.post('/', async (req, res) => {
  const { name, address, latitude, longitude } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Missing name' });

  let conn;
  try {
    conn = await pool.getConnection();
    const [existing] = await conn.execute('SELECT name FROM company WHERE name = ?', [name]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'บริษัทนี้มีอยู่แล้ว' });

    await conn.execute(
      'INSERT INTO company (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name, address || null, latitude || null, longitude || null]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/company error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});


// ลบบริษัท
router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  try {
    await pool.execute('DELETE FROM company WHERE name = ?', [name]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;