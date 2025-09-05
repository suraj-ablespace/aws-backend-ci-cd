const express = require('express');

const app = express();
const PORT = process.env.PORT || 9001;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from root API' });
});

app.get('/test-ci', (req, res) => {
  res.json({
    message: 'Bhai!...mai bhi deploy hogya. badhai ho bhai',
    timestamp: new Date().toISOString(),
  });
});

//testing ci/cd 


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
