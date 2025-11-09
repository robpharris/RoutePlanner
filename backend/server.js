const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Health endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Route Planner API is running'
  });
});

// File upload endpoint
app.post('/api/upload-addresses', upload.single('file'), (req, res) => {
  console.log('File upload received:', req.file ? req.file.filename : 'No file');
  
  // Return mock optimized route for demonstration
  const mockRoute = [
    { id: '1', address: '123 Main St', latitude: 40.7128, longitude: -74.0060, name: 'Stop 1' },
    { id: '2', address: '456 Oak Ave', latitude: 40.7589, longitude: -73.9851, name: 'Stop 2' },
    { id: '3', address: '789 Pine Rd', latitude: 40.7282, longitude: -73.7949, name: 'Stop 3' }
  ];
  
  res.json({
    success: true,
    optimizedRoute: mockRoute,
    totalDistance: 15.5,
    estimatedTime: 45,
    navigationUrls: {
      googleMaps: 'https://maps.google.com/dir/' + mockRoute.map(r => r.address).join('/'),
      waze: 'https://waze.com/ul'
    },
    message: `Successfully processed file. Found ${mockRoute.length} addresses. This is demo data - full optimization integration coming next!`
  });
});

// Route optimization endpoint
app.post('/api/optimize-route', (req, res) => {
  console.log('Route optimization requested');
  const { addresses, startLocation } = req.body;
  
  if (!addresses || !Array.isArray(addresses)) {
    return res.status(400).json({ error: 'Invalid addresses data' });
  }
  
  console.log(`Optimizing route for ${addresses.length} addresses`);
  
  // Mock optimization - shuffle addresses to simulate optimization
  const optimizedRoute = [...addresses].sort(() => Math.random() - 0.5);
  
  res.json({
    success: true,
    optimizedRoute: optimizedRoute,
    totalDistance: (addresses.length * 2.5).toFixed(1),
    estimatedTime: Math.round(addresses.length * 8.5),
    navigationUrls: {
      googleMaps: 'https://maps.google.com/dir/' + optimizedRoute.slice(0, 5).map(r => r.address).join('/'),
      waze: 'https://waze.com/ul'
    },
    message: `Route optimized! Processed ${addresses.length} stops. This is mock optimization - real algorithm integration coming next!`
  });
});

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

// Start server with better error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Route Planner API running on http://localhost:${port}`);
  console.log(`🏥 Health: http://localhost:${port}/api/health`);
  console.log(`📁 Upload: http://localhost:${port}/api/upload-addresses`);
  console.log(`🔧 Optimize: http://localhost:${port}/api/optimize-route`);
  console.log(`🚀 Server is ready for requests!`);
});

server.on('error', (error) => {
  console.error('💥 Server startup error:', error);
});

server.on('close', () => {
  console.log('🔴 Server closed');
});

// Keep alive
setInterval(() => {
  console.log(`Server alive at ${new Date().toLocaleTimeString()}`);
}, 30000);

module.exports = app;