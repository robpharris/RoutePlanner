#!/usr/bin/env node

/**
 * STANDALONE ROUTE OPTIMIZER
 * No server needed - just run: node optimize-my-route.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚛 STANDALONE ROUTE OPTIMIZER');
console.log('===============================');

// Simple CSV parser
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map(v => v.trim());
    const address = {};
    headers.forEach((header, i) => {
      address[header] = values[i] || '';
    });
    address.id = (index + 1).toString();
    return address;
  });
}

// Haversine distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Simple geocoding (you'd replace this with real geocoding)
function mockGeocode(address) {
  const hash = address.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return {
    latitude: 40.7128 + (hash % 1000) / 10000,
    longitude: -74.0060 + (hash % 1000) / 10000
  };
}

// Nearest neighbor TSP
function optimizeRoute(addresses) {
  if (addresses.length <= 1) return addresses;
  
  const route = [];
  const unvisited = [...addresses];
  
  // Start with first address
  let current = unvisited.shift();
  route.push(current);
  
  while (unvisited.length > 0) {
    let nearest = unvisited[0];
    let shortestDistance = calculateDistance(
      current.latitude, current.longitude,
      nearest.latitude, nearest.longitude
    );
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.latitude, current.longitude,
        unvisited[i].latitude, unvisited[i].longitude
      );
      
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearest = unvisited[i];
      }
    }
    
    route.push(nearest);
    unvisited.splice(unvisited.indexOf(nearest), 1);
    current = nearest;
  }
  
  return route;
}

function calculateTotalDistance(route) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += calculateDistance(
      route[i].latitude, route[i].longitude,
      route[i + 1].latitude, route[i + 1].longitude
    );
  }
  return total;
}

// Main function
function main() {
  const csvFile = process.argv[2] || 'sample-addresses.csv';
  
  if (!fs.existsSync(csvFile)) {
    console.log('❌ CSV file not found:', csvFile);
    console.log('Usage: node optimize-my-route.js your-file.csv');
    return;
  }
  
  console.log('📁 Reading file:', csvFile);
  
  try {
    // Parse CSV
    const addresses = parseCSV(csvFile);
    console.log(`📍 Found ${addresses.length} addresses`);
    
    // Mock geocoding (add real coordinates)
    addresses.forEach(addr => {
      const coords = mockGeocode(addr.address || addr['St Name'] || addr.Product);
      addr.latitude = coords.latitude;
      addr.longitude = coords.longitude;
    });
    
    // Calculate original route distance
    const originalDistance = calculateTotalDistance(addresses);
    console.log(`📏 Original route distance: ${originalDistance.toFixed(2)} km`);
    
    // Optimize route
    console.log('🔄 Optimizing route...');
    const startTime = Date.now();
    const optimizedRoute = optimizeRoute(addresses);
    const optimizedDistance = calculateTotalDistance(optimizedRoute);
    const duration = Date.now() - startTime;
    
    // Results
    const improvement = ((originalDistance - optimizedDistance) / originalDistance * 100);
    
    console.log('\n✅ OPTIMIZATION COMPLETE');
    console.log('========================');
    console.log(`⏱️  Time: ${duration}ms`);
    console.log(`📏 Optimized distance: ${optimizedDistance.toFixed(2)} km`);
    console.log(`📈 Improvement: ${improvement.toFixed(1)}%`);
    console.log(`💰 Distance saved: ${(originalDistance - optimizedDistance).toFixed(2)} km`);
    
    // Save optimized route
    const outputFile = csvFile.replace('.csv', '_optimized.csv');
    const headers = Object.keys(addresses[0]).filter(k => k !== 'latitude' && k !== 'longitude');
    const csvContent = [
      headers.join(','),
      ...optimizedRoute.map((addr, index) => 
        headers.map(h => h === 'id' ? index + 1 : addr[h]).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(outputFile, csvContent);
    console.log(`📄 Optimized route saved to: ${outputFile}`);
    
    if (improvement > 10) {
      console.log('\n🎉 GREAT OPTIMIZATION! This would save significant time and fuel!');
    } else if (improvement > 0) {
      console.log('\n✅ Route improved. Every bit of optimization helps!');
    } else {
      console.log('\n📝 Route was already quite efficient.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { optimizeRoute, calculateDistance };