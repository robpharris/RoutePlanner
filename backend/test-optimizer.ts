#!/usr/bin/env tsx

import { RouteOptimizer } from './src/services/RouteOptimizer';

interface TestAddress {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  name?: string;
}

async function testRouteOptimization() {
  console.log('🧪 Testing Enhanced Route Optimization\n');
  
  // Create test addresses (simulating real delivery locations)
  const testAddresses: TestAddress[] = [
    { id: '1', address: '123 Main St', latitude: 40.7128, longitude: -74.0060, name: 'Stop 1' },
    { id: '2', address: '456 Oak Ave', latitude: 40.7589, longitude: -73.9851, name: 'Stop 2' },
    { id: '3', address: '789 Pine Rd', latitude: 40.7282, longitude: -73.7949, name: 'Stop 3' },
    { id: '4', address: '321 Elm St', latitude: 40.6892, longitude: -74.0445, name: 'Stop 4' },
    { id: '5', address: '654 Maple Dr', latitude: 40.7505, longitude: -73.9934, name: 'Stop 5' },
    { id: '6', address: '987 Cedar Ln', latitude: 40.7614, longitude: -73.9776, name: 'Stop 6' },
    { id: '7', address: '147 Birch Way', latitude: 40.7549, longitude: -73.9840, name: 'Stop 7' },
    { id: '8', address: '258 Walnut Ct', latitude: 40.7462, longitude: -73.9863, name: 'Stop 8' },
  ];
  
  console.log(`📍 Test Dataset: ${testAddresses.length} addresses`);
  console.log('Addresses:');
  testAddresses.forEach((addr, i) => {
    console.log(`  ${i + 1}. ${addr.name} - ${addr.address}`);
  });
  
  console.log('\n🔄 Testing Route Optimization...\n');
  
  const optimizer = new RouteOptimizer();
  
  try {
    // Test the optimized route
    console.time('⏱️  Optimization Time');
    const optimizedRoute = await optimizer.optimizeRoute(testAddresses);
    console.timeEnd('⏱️  Optimization Time');
    
    console.log('\n✅ Optimized Route:');
    optimizedRoute.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr.name} - ${addr.address}`);
    });
    
    // Calculate metrics
    const metrics = await optimizer.calculateRouteMetrics(optimizedRoute);
    console.log(`\n📊 Route Metrics:`);
    console.log(`   Total Distance: ${metrics.totalDistance.toFixed(2)} km`);
    console.log(`   Estimated Time: ${metrics.estimatedTime.toFixed(0)} minutes`);
    
    // Compare with unoptimized (original order)
    const unoptimizedMetrics = await optimizer.calculateRouteMetrics(testAddresses);
    console.log(`\n📈 Comparison with Original Order:`);
    console.log(`   Original Distance: ${unoptimizedMetrics.totalDistance.toFixed(2)} km`);
    console.log(`   Original Time: ${unoptimizedMetrics.estimatedTime.toFixed(0)} minutes`);
    
    const distanceImprovement = ((unoptimizedMetrics.totalDistance - metrics.totalDistance) / unoptimizedMetrics.totalDistance * 100);
    const timeImprovement = ((unoptimizedMetrics.estimatedTime - metrics.estimatedTime) / unoptimizedMetrics.estimatedTime * 100);
    
    console.log(`\n🎯 Optimization Results:`);
    console.log(`   Distance Improvement: ${distanceImprovement.toFixed(1)}%`);
    console.log(`   Time Improvement: ${timeImprovement.toFixed(1)}%`);
    
    if (distanceImprovement > 0) {
      console.log(`\n✅ SUCCESS: Route optimization improved efficiency!`);
    } else {
      console.log(`\n⚠️  WARNING: No improvement detected. Algorithm needs tuning.`);
    }
    
  } catch (error) {
    console.error('❌ Error during optimization:', error);
  }
}

// Run the test
testRouteOptimization().then(() => {
  console.log('\n🏁 Test completed!');
}).catch(error => {
  console.error('💥 Test failed:', error);
});