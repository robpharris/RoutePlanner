const express = require('express');
const cors = require('cors');

const app = express();
const port = 3003; // Try different port

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: port,
    message: 'Route Planner API is working!'
  });
});

// File upload mock (since multer might be causing issues)
app.post('/api/upload-addresses', (req, res) => {
  console.log('File upload mock endpoint hit');
  res.json({
    success: true,
    message: 'Upload endpoint working - multer disabled for testing',
    addresses: [
      { id: '1', address: '123 Main St', latitude: 40.7128, longitude: -74.0060 },
      { id: '2', address: '456 Oak Ave', latitude: 40.7589, longitude: -73.9851 }
    ]
  });
});

// Route optimization
app.post('/api/optimize-route', (req, res) => {
  console.log('Route optimization requested');
  const { addresses } = req.body;
  
  if (!addresses) {
    return res.status(400).json({ error: 'No addresses provided' });
  }
  
  console.log(`Processing ${addresses.length} addresses`);
  
  // Simple mock optimization
  const optimizedRoute = addresses.map((addr, index) => ({
    ...addr,
    order: index + 1
  }));
  
  res.json({
    success: true,
    optimizedRoute: optimizedRoute,
    totalDistance: addresses.length * 2.5,
    estimatedTime: addresses.length * 8,
    navigationUrls: {
      googleMaps: `https://maps.google.com`,
      waze: `https://waze.com`
    },
    message: `Successfully optimized route for ${addresses.length} stops!`
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error', details: err.message });
});

// Start server
console.log('Starting server...');
const server = app.listen(port, '127.0.0.1', () => {
  console.log('='.repeat(50));
  console.log(`🚀 SERVER RUNNING SUCCESSFULLY`);
  console.log(`📍 URL: http://localhost:${port}`);
  console.log(`🏥 Health: http://localhost:${port}/api/health`);
  console.log(`📁 Upload: http://localhost:${port}/api/upload-addresses`);
  console.log(`🔧 Optimize: http://localhost:${port}/api/optimize-route`);
  console.log('='.repeat(50));
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});