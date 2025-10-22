require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();
connectDB();

// ✅ CORS setup to allow only your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'  // Uses FRONTEND_URL from .env
}));

app.use(express.json());

// routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/items', require('./src/routes/items'));

app.get('/', (req, res) => res.send('Lost & Found API'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
