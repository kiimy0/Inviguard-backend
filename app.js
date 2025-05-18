const express = require('express');
const app = express();
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');

// Middleware
app.use(express.json()); // JSON parsing할 수 있게

// Routes
app.use('/api/chat', chatRoutes)

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
