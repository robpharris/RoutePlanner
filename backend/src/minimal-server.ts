const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 3002;

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
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Route Planner API is running'
  });
});

// File upload endpoint
app.post('/api/upload-addresses', upload.single('file'), (req, res) => {
  console.log('📁 File upload received');
  
  // Return mock optimized route for now
  const mockRoute = [
    { id: '1', address: '123 Main St', latitude: 40.7128, longitude: -74.0060 },
    { id: '2', address: '456 Oak Ave', latitude: 40.7589, longitude: -73.9851 },
    { id: '3', address: '789 Pine Rd', latitude: 40.7282, longitude: -73.7949 }
  ];
  
  res.json({
    success: true,
    optimizedRoute: mockRoute,
    totalDistance: 15.5,
    estimatedTime: 45,
    navigationUrls: {
      googleMaps: 'https://maps.google.com',
      waze: 'https://waze.com'
    },
    message: 'File processed successfully - using mock data for demo'
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Route Planner API running on http://localhost:${port}`);
  console.log(`🏥 Health: http://localhost:${port}/api/health`);
  console.log(`📁 Upload: http://localhost:${port}/api/upload-addresses`);
});

console.log('🚀 Server startup complete');