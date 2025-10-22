require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();
connectDB();

// ✅ CORS setup to allow only your frontend and local testing
const allowedOrigins = [
  (process.env.FRONTEND_URL || '').replace(/\/$/, ''), // Remove trailing slash
  'http://localhost:5173' // optional for local frontend testing
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // allow request
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/items', require('./src/routes/items'));

// Root route
app.get('/', (req, res) => res.send('Lost & Found API'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
