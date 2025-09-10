require('dotenv').config();
const express = require('express');
const path = require('path');
const timeRecordRoutes = require('./routes/timeRecord');
const { createServer: createViteServer } = require('vite');
const companyRoutes = require('./routes/company');
const employeeRoutes = require('./routes/employees');
const login = require('./routes/login.js')

const app = express();

const cors = require('cors');
app.use(cors({
  origin: 'https://check-in-out.vercel.app/', // URL frontend 
  credentials: true
}));

// ใช้ express.json() แทน body-parser
app.use(express.json());

// API routes
app.use('/api/time-record', timeRecordRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/login', login);

async function startServer() {
  const vite = await createViteServer({
    root: path.resolve(__dirname, '../timestamp'),
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);

  // catch-all SPA route
  app.use(/^(?!\/api).*/, async (req, res, next) => {
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>TIME_OUT</title>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server + Vite running at http://localhost:${PORT}`));
}

startServer();
