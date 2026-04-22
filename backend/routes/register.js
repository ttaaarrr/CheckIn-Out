const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

const validPassword = pwd =>
  pwd.length >= 8 &&
  /[A-Z]/.test(pwd) &&
  /[a-z]/.test(pwd) &&
  /[0-9]/.test(pwd) &&
  /[^A-Za-z0-9]/.test(pwd);

router.post('/', async (req, res) => {

  const { token, username, password, name, emp_id } = req.body;

  if (!username || !password || !token)
    return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });

  if (!validPassword(password))
    return res.status(400).json({
      message: 'รหัสผ่านต้องมี พิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ'
    });

  try {

    // ตรวจ invite link
    const [invite] = await pool.query(
      `SELECT * FROM invite_links
       WHERE token = ?
       AND expire_date > NOW()
       AND used_count < max_use`,
      [token]
    );

    if (invite.length === 0)
      return res.status(400).json({ message: 'ลิงก์สมัครหมดอายุ' });

    const company_id = invite[0].company_id;

    // เช็ค username ซ้ำ
    const [exist] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (exist.length > 0)
      return res.status(409).json({ message: 'Username ถูกใช้งานแล้ว' });

    const hash = await bcrypt.hash(password, 10);

    // สร้าง user
    await pool.query(
      `INSERT INTO users (company_id, emp_id, name, username, password, role)
       VALUES (?, ?, ?, ?, ?, 'user')`,
      [company_id, emp_id, name, username, hash]
    );

    // update การใช้ invite
    await pool.query(
      `UPDATE invite_links
       SET used_count = used_count + 1
       WHERE token = ?`,
      [token]
    );

    res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ'
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: 'Server error'
    });

  }

});

module.exports = router;