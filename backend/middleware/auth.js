const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      code: 'SESSION_EXPIRED',
      message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      code: 'SESSION_EXPIRED',
      message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({
      code: 'SESSION_EXPIRED',
      message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }
};
