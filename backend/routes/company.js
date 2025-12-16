const express = require('express');
const pool = require('../db'); 
const router = express.Router();

// ดึงรายชื่อบริษัท
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT id, name, address, latitude, longitude, radius_km FROM company');
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
  const { name, address, latitude, longitude, radius_km } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Missing name' });

  let conn;
  try {
    conn = await pool.getConnection();
    const [existing] = await conn.execute('SELECT name FROM company WHERE name = ?', [name]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'บริษัทนี้มีอยู่แล้ว' });

    await conn.execute(
      'INSERT INTO company (name, address, latitude, longitude ,radius_km) VALUES (?, ?, ?, ?, ?)',
      [name, address || null, latitude || null, longitude || null, radius_km || 0.05 ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/company error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});
// แก้ไขบริษัท + อัปเดตทุกตารางที่เกี่ยวข้อง
router.put('/:name', async (req, res) => {
  const oldName = req.params.name;  // ชื่อเดิม
  const { name, address, latitude, longitude, radius_km } = req.body; // ข้อมูลใหม่

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); //  ป้องกันข้อมูลค้าง ครึ่งๆกลางๆ

    // ตรวจสอบชื่อบริษัทซ้ำ (ถ้าชื่อใหม่ != เดิม)
    if (name && name !== oldName) {
      const [exists] = await conn.execute(
        'SELECT name FROM company WHERE name = ?',
        [name]
      );
      if (exists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'ชื่อบริษัทนี้มีอยู่แล้ว'
        });
      }
    }

    // อัปเดตใน company
    await conn.execute(
      `UPDATE company
       SET name = ?, address = ?, latitude = ?, longitude = ?, radius_km = ?
       WHERE name = ?`,
      [name, address, latitude,  longitude, radius_km, oldName]
    );

    //  อัปเดตใน employees
    await conn.execute(
      `UPDATE employees
       SET company_name = ?
       WHERE company_name = ?`,
      [name, oldName]
    );

    //  อัปเดตใน time_records
    await conn.execute(
      `UPDATE time_records
       SET company_name = ?
       WHERE company_name = ?`,
      [name, oldName]
    );

    await conn.commit(); // ยืนยันทั้งหมด

    res.json({ success: true });

  } catch (err) {
    if (conn) await conn.rollback(); // ย้อนกลับทั้งหมดถ้าพัง
    console.error('PUT /api/company/:name error:', err);
    res.status(500).json({ success: false, message: 'Database error' });

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