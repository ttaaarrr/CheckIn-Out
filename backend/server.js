require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Routes
const timeRecordRoutes = require('./routes/timeRecord');
const companyRoutes = require('./routes/company');
const employeeRoutes = require('./routes/employees');
const login = require('./routes/login'); 
// const otRequestRoutes = require('./routes/ot-request');

const app = express();

//  Config CORS
const allowedOrigins = [
  "https://check-in-out.vercel.app",
  "http://localhost:5174"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

//  ใช้ middleware
app.use(cors(corsOptions));
app.use(express.json());

// API routes

app.use('/api/login', login); // login route
app.use('/api/time-record', timeRecordRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employees', employeeRoutes);
// app.use('/api/ot-request', otRequestRoutes);
// Health check
app.get('/health', (req, res) => res.send('OK'));
// Start server
const PORT = process.env.PORT || 3009;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

