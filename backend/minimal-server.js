const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting minimal server...');

const app = express();
const port = 3003;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('✅ Health check requested');
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Route Planner API is working!',
        port: port
    });
});

// Route optimization endpoint with real TSP algorithm
app.post('/api/optimize-route', (req, res) => {
    console.log('🔧 Route optimization requested');
    const { addresses, startingPoint } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({ 
            error: 'Missing or invalid addresses array' 
        });
    }
    
    console.log(`Processing ${addresses.length} addresses`);
    
    // Add starting point if provided, otherwise use first address
    const depot = startingPoint || addresses[0];
    console.log(`Starting point: ${depot.address}`);
    
    // Calculate distances between points using Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Nearest neighbor TSP algorithm with 2-opt improvement
    function optimizeRoute(addresses, startPoint) {
        if (addresses.length <= 2) return addresses;
        
        const unvisited = [...addresses];
        const route = [];
        
        // Start from depot/starting point
        let current = startPoint;
        route.push(current);
        unvisited.splice(unvisited.findIndex(a => a.id === current.id), 1);
        
        // Nearest neighbor construction
        while (unvisited.length > 0) {
            let nearestIndex = 0;
            let shortestDistance = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const distance = calculateDistance(
                    current.latitude, current.longitude,
                    unvisited[i].latitude, unvisited[i].longitude
                );
                
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestIndex = i;
                }
            }
            
            current = unvisited[nearestIndex];
            route.push(current);
            unvisited.splice(nearestIndex, 1);
        }
        
        // 2-opt improvement
        let improved = true;
        let iterations = 0;
        const maxIterations = 100;
        
        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;
            
            for (let i = 1; i < route.length - 2; i++) {
                for (let j = i + 1; j < route.length - 1; j++) {
                    // Calculate current distance
                    const currentDist = 
                        calculateDistance(route[i].latitude, route[i].longitude, route[i+1].latitude, route[i+1].longitude) +
                        calculateDistance(route[j].latitude, route[j].longitude, route[j+1].latitude, route[j+1].longitude);
                    
                    // Calculate distance after 2-opt swap
                    const newDist = 
                        calculateDistance(route[i].latitude, route[i].longitude, route[j].latitude, route[j].longitude) +
                        calculateDistance(route[i+1].latitude, route[i+1].longitude, route[j+1].latitude, route[j+1].longitude);
                    
                    if (newDist < currentDist) {
                        // Perform 2-opt swap
                        route.splice(i + 1, j - i, ...route.slice(i + 1, j + 1).reverse());
                        improved = true;
                    }
                }
            }
        }
        
        console.log(`Route optimized in ${iterations} iterations`);
        return route;
    }
    
    // Optimize the route
    const optimizedRoute = optimizeRoute(addresses, depot);
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < optimizedRoute.length - 1; i++) {
        totalDistance += calculateDistance(
            optimizedRoute[i].latitude, optimizedRoute[i].longitude,
            optimizedRoute[i + 1].latitude, optimizedRoute[i + 1].longitude
        );
    }
    
    // Generate proper navigation URLs
    const waypoints = optimizedRoute.map(addr => 
        encodeURIComponent(addr.address)
    ).join('/');
    
    const coordinateString = optimizedRoute.map(addr => 
        `${addr.latitude},${addr.longitude}`
    ).join('|');
    
    const googleMapsUrl = `https://www.google.com/maps/dir/${waypoints}`;
    const wazeUrl = `https://waze.com/ul?ll=${optimizedRoute[0].latitude},${optimizedRoute[0].longitude}&navigate=yes`;
    
    // Add order to addresses
    const routeWithOrder = optimizedRoute.map((addr, index) => ({
        ...addr,
        optimizedOrder: index + 1,
        estimatedArrival: `${Math.floor(index * 3)}min` // Mock time estimate
    }));
    
    console.log(`✅ Route optimized: ${totalDistance.toFixed(2)} km total distance`);
    
    res.json({
        success: true,
        optimizedRoute: routeWithOrder,
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedTime: Math.round(totalDistance * 2), // Rough estimate: 2 minutes per km
        originalDistance: addresses.length * 2, // Mock original for comparison
        improvementPercent: Math.round(((addresses.length * 2 - totalDistance) / (addresses.length * 2)) * 100),
        navigationUrls: {
            googleMaps: googleMapsUrl,
            waze: wazeUrl,
            fullRoute: googleMapsUrl
        },
        startingPoint: depot.address,
        message: `Successfully optimized route with ${addresses.length} stops. Starting from: ${depot.address}`
    });
});

// File upload endpoint (now with real CSV processing)
app.post('/api/upload-addresses', upload.single('csvFile'), (req, res) => {
    console.log('📁 File upload requested');
    
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }
    
    console.log(`Processing file: ${req.file.originalname}`);
    
    const results = [];
    
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            // Handle different CSV formats
            let address = '';
            let name = '';
            
            // Check for delivery format (St Num, St Name, APT#, Zip)
            if (data['St Num'] && data['St Name']) {
                const stNum = data['St Num'] || '';
                const stName = data['St Name'] || '';
                const apt = data['APT#'] || '';
                const zip = data['Zip'] || '';
                
                address = `${stNum} ${stName}`;
                if (apt) address += `, ${apt}`;
                if (zip) address += `, Folsom, CA ${zip}`;
                else address += `, Folsom, CA`;
                
                name = data['Product'] || `Stop ${results.length + 1}`;
            }
            // Check for simple address format
            else if (data.address) {
                address = data.address;
                name = data.name || `Stop ${results.length + 1}`;
            }
            // Check for any column that looks like an address
            else {
                const keys = Object.keys(data);
                const addressKey = keys.find(key => 
                    key.toLowerCase().includes('address') || 
                    key.toLowerCase().includes('street') ||
                    key.toLowerCase().includes('location')
                );
                
                if (addressKey) {
                    address = data[addressKey];
                    name = data.name || data.Name || `Stop ${results.length + 1}`;
                }
            }
            
            if (address) {
                results.push({
                    id: (results.length + 1).toString(),
                    address: address.trim(),
                    name: name,
                    latitude: 38.6781 + (Math.random() - 0.5) * 0.1, // Mock coords around Folsom
                    longitude: -121.1761 + (Math.random() - 0.5) * 0.1
                });
                console.log(`Added address: ${address}`);
            }
        })
        .on('end', () => {
            console.log(`Successfully processed ${results.length} addresses`);
            
            // Clean up uploaded file
            fs.unlink(req.file.path, (err) => {
                if (err) console.log('Error cleaning up file:', err);
            });
            
            res.json({
                success: true,
                message: `Successfully processed ${results.length} addresses from ${req.file.originalname}`,
                addresses: results
            });
        })
        .on('error', (error) => {
            console.error('Error processing CSV:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process CSV file'
            });
        });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('💥 Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404 - ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start the server
const server = app.listen(port, () => {
    console.log('========================================');
    console.log('🟢 SERVER RUNNING SUCCESSFULLY!');
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🏥 Health: http://localhost:${port}/api/health`);
    console.log(`📁 Upload: http://localhost:${port}/api/upload-addresses`);
    console.log(`🔧 Optimize: http://localhost:${port}/api/optimize-route`);
    console.log('========================================');
});

server.on('error', (error) => {
    console.error('💥 Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please kill other processes or use a different port.`);
    }
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
});

console.log(`🎯 Server starting on port ${port}...`);