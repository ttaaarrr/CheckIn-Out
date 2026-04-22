const express = require('express');
const pool = require('../db'); 
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ดึงรายชื่อบริษัท
router.get('/', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const { role, id } = req.user;

    let sql = 'SELECT name, address, latitude, longitude, time_in, time_out FROM company';
    let params = [];

    if (role === 'manager') {
      sql += ' WHERE added_by = ?';
      params.push(id);
    }

    const [rows] = await conn.execute(sql, params);

    res.json({ success: true, companies: rows });
  } catch (err) {
    console.error('GET /api/company error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    if (conn) conn.release();
  }
});
// ดึงชื่อบริษัทที่หน้าลงเวลา
router.get('/public', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT name, address, latitude, longitude, time_in, time_out FROM company'
    );
    res.json({ success: true, companies: rows });
  } catch (err) {
    res.status(500).json({ success: false });
  } finally {
    if (conn) conn.release();
  }
});
// เพิ่มบริษัท
router.post('/', authMiddleware, async (req, res) => {
   console.log('JWT USER =', req.user); 
  const { name, address, latitude, longitude, time_in, time_out } = req.body;
  const { id } = req.user; // user ที่ล็อกอิน
 
  if (!name) {
    return res.status(400).json({ success: false, message: 'Missing name' });
  }
  if (!time_in || !time_out) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกเวลาเข้างานและเลิกงาน'
    });
  }

  if (time_in >= time_out) {
    return res.status(400).json({
      success: false,
      message: 'เวลาเข้างานต้องน้อยกว่าเวลาเลิกงาน'
    });
  }
  let conn;
  try {
    conn = await pool.getConnection();

    const [existing] = await conn.execute(
      'SELECT name FROM company WHERE name = ?',
      [name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'บริษัทนี้มีอยู่แล้ว' });
    }

    await conn.execute(
      `INSERT INTO company (name, address, latitude, longitude, added_by, time_in, time_out)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, address || null, latitude || null, longitude || null, id, time_in, time_out]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/company error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// แก้ไขบริษัท
router.put('/:name', authMiddleware, async (req, res) => {
  const oldName = req.params.name;

  const {
    name,
    address,
    latitude,
    longitude,
    radius_km,
    time_in,
    time_out
  } = req.body;

  const { role, id } = req.user;

  // validation
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'กรอกชื่อบริษัท'
    });
  }

  if (!time_in || !time_out) {
    return res.status(400).json({
      success: false,
      message: 'กรุณากรอกเวลาเข้างานและเลิกงาน'
    });
  }

  if (time_in >= time_out) {
    return res.status(400).json({
      success: false,
      message: 'เวลาเข้างานต้องน้อยกว่าเวลาเลิกงาน'
    });
  }

  if (!radius_km || radius_km <= 0) {
    return res.status(400).json({
      success: false,
      message: 'radius_km ไม่ถูกต้อง'
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // เช็กสิทธิ์
    const [rows] = await conn.execute(
      'SELECT added_by FROM company WHERE name = ?',
      [oldName]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    if (role === 'manager' && Number(rows[0].added_by) !== Number(id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    // UPDATE company (⭐ จุดสำคัญ)
    await conn.execute(
      `UPDATE company 
       SET 
         name = ?,
         address = ?,
         latitude = ?,
         longitude = ?,
         radius_km = ?,
         time_in = ?,
         time_out = ?
       WHERE name = ?`,
      [
        name,
        address,
        latitude,
        longitude,
        radius_km,
        time_in,
        time_out,
        oldName
      ]
    );

    // UPDATE employees ให้ตามชื่อใหม่
    await conn.execute(
      `UPDATE employees
       SET company_name = ?
       WHERE company_name = ?`,
      [name, oldName]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error('PUT /api/company error:', err);
    res.status(500).json({
      success: false,
      message: 'Database error'
    });
  } finally {
    if (conn) conn.release();
  }
});

// ลบบริษัท
router.delete('/:name', authMiddleware, async (req, res) => {
  const { name } = req.params;
  const { role, id } = req.user;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. เช็กสิทธิ์
    const [rows] = await conn.execute(
      'SELECT added_by FROM company WHERE name = ?',
      [name]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (role === 'manager' && Number(rows[0].added_by) !== Number(id)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // 2. ลบข้อมูลลูกก่อน
    await conn.execute(
      'DELETE FROM time_records WHERE company_name = ?',
      [name]
    );

    await conn.execute(
      'DELETE FROM employees WHERE company_name = ?',
      [name]
    );

    // 3. ลบบริษัท
    await conn.execute(
      'DELETE FROM company WHERE name = ?',
      [name]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error('DELETE company error:', err);
    res.status(500).json({ success: false, message: 'Delete failed' });
  } finally {
    if (conn) conn.release();
  }
});


module.exports = router;