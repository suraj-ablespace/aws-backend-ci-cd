const express = require('express');

const app = express();
const PORT = process.env.PORT || 9001;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from root API' });
});

app.get('/health', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.json({
    status: 'ok',
    uptime,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
