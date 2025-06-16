const express = require('express');
const app = express();
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');
const db = require('./config/db');

// Middleware
app.use(express.json()); // JSON parsing할 수 있게

// Routes
app.use('/api/chat', chatRoutes);

// DB connection test
const testDBConnection = async () => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    console.log('MySQL connection success! Current time :', rows[0].now);
  } catch (err) {
    console.error('DB connection failed:', err.message);
  }
};
testDBConnection();

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));