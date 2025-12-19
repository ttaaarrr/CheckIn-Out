const express = require('express');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();

// admin เพิ่ม manager
router.post('/manager', authMiddleware, async (req, res) => {
  const { role } = req.user;

  // เช็กสิทธิ์
  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing data' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // ตรวจซ้ำ
    const [existing] = await conn.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await conn.execute(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashed, 'manager']
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
