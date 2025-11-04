console.log('Starting ultra-simple server...');

const express = require('express');
const cors = require('cors');

console.log('Express loaded successfully');

const app = express();
const port = 3002;

console.log('Configuring middleware...');
app.use(cors());
app.use(express.json());

console.log('Setting up routes...');

app.get('/api/health', (req, res) => {
  console.log('Health check received!');
  res.json({ status: 'OK', message: 'Simple server working!' });
});

app.post('/api/optimize-route', (req, res) => {
  console.log('Optimize route received!');
  res.json({ 
    success: true, 
    message: 'Optimization endpoint working!',
    optimizedRoute: [{ id: '1', address: 'Test Address' }]
  });
});

console.log('Starting server...');
const server = app.listen(port, () => {
  console.log(`🎯 ULTRA SIMPLE server running on http://localhost:${port}`);
  console.log('✅ Ready for testing!');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

console.log('Server setup complete!');