require('dotenv').config();
const express = require('express');
const cors = require('cors');
const timeRecordRoutes = require('./routes/timeRecord');
const companyRoutes = require('./routes/company');
const employeeRoutes = require('./routes/employees');
const login = require('./routes/login');
const otRequestRoutes = require('./routes/ot-request');

const app = express();

app.use(cors({
  origin: ['https://check-in-out.vercel.app', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

// API routes
app.use('/api/time-record', timeRecordRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/login', login);
app.use('/api/ot-request', otRequestRoutes);
// Health check
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
