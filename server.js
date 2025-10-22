require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();
connectDB();

// ✅ CORS setup to allow local and deployed frontend
const allowedOrigins = [
  'http://localhost:3000', // local frontend
  (process.env.FRONTEND_URL || '').replace(/\/$/, '') // deployed frontend
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true); // allow request
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/items', require('./src/routes/items'));

// Root route
app.get('/', (req, res) => res.send('Lost & Found API'));

// Global error handler (especially for CORS)
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ msg: err.message });
  }
  console.error(err);
  res.status(500).json({ msg: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
