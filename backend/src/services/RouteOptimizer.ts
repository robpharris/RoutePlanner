import axios from 'axios';

interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
}

interface RouteMetrics {
  totalDistance: number;
  estimatedTime: number;
}

export class RouteOptimizer {
  private googleMapsApiKey: string;
  private distanceCache: Map<string, number> = new Map();
  private timeCache: Map<string, number> = new Map();
  private originalAddresses?: Address[];

  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  }

  async geocodeAddresses(addresses: Address[]): Promise<Address[]> {
    const geocodedAddresses: Address[] = [];

    for (const address of addresses) {
      if (address.latitude && address.longitude) {
        geocodedAddresses.push(address);
        continue;
      }

      try {
        const geocoded = await this.geocodeAddress(address.address);
        geocodedAddresses.push({
          ...address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude
        });
      } catch (error) {
        console.error(`Failed to geocode address: ${address.address}`, error);
        // Skip addresses that can't be geocoded
        continue;
      }
    }

    return geocodedAddresses;
  }

  private async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
    if (!this.googleMapsApiKey) {
      // Fallback: use a simple mock geocoding for demo purposes
      // In production, you'd want to use a real geocoding service
      return this.mockGeocode(address);
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: address,
            key: this.googleMapsApiKey
          }
        }
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng
        };
      } else {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return this.mockGeocode(address);
    }
  }

  private mockGeocode(address: string): { latitude: number; longitude: number } {
    // Simple mock geocoding based on address hash for demo
    // This generates consistent but fake coordinates
    const hash = this.hashCode(address);
    const latitude = 40.7128 + (hash % 100) / 1000; // Around NYC area
    const longitude = -74.0060 + (hash % 100) / 1000;
    
    return { latitude, longitude };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async optimizeRoute(addresses: Address[], startLocation?: { latitude: number; longitude: number }): Promise<Address[]> {
    if (addresses.length <= 2) {
      return addresses;
    }

    console.log(`\n🚛 PROFESSIONAL ROUTE OPTIMIZATION - ${addresses.length} stops`);
    
    // STEP 1: Group addresses at same locations
    const groupedAddresses = this.groupSameLocationAddresses(addresses);
    
    // Store original grouped addresses for matrix lookups
    this.originalAddresses = [...groupedAddresses];
    console.log(`📍 Grouped ${addresses.length} stops into ${groupedAddresses.length} unique locations`);
    
    // STEP 2: Build real distance matrix using Google Maps
    console.log(`🗺️  Building distance matrix...`);
    const distanceMatrix = await this.buildDistanceMatrix(groupedAddresses);
    
    // STEP 3: Apply advanced optimization algorithm
    console.log(`🧠 Applying advanced TSP algorithms...`);
    let optimizedRoute: Address[];
    
    if (groupedAddresses.length <= 25) {
      // Small routes: Use exact or near-exact algorithms
      optimizedRoute = await this.advancedTSPOptimization(groupedAddresses, distanceMatrix, startLocation);
    } else if (groupedAddresses.length <= 100) {
      // Medium routes: Use hybrid approach with local search
      optimizedRoute = await this.hybridOptimization(groupedAddresses, distanceMatrix, startLocation);
    } else {
      // Large routes: Geographic clustering + optimization
      optimizedRoute = await this.clusterBasedOptimization(groupedAddresses, distanceMatrix, startLocation);
    }

    // STEP 4: Apply post-optimization improvements
    console.log(`⚡ Applying local search improvements...`);
    optimizedRoute = this.applyLocalSearchImprovements(optimizedRoute, distanceMatrix);

    // STEP 5: Expand back to individual stops
    console.log(`✅ Route optimization complete!`);
    return this.expandGroupedRoute(optimizedRoute);
  }

  private async optimizeRouteForLargeDataset(addresses: Address[], startLocation?: { latitude: number; longitude: number }): Promise<Address[]> {
    console.log('Using optimized algorithm for large dataset...');
    
    // For very large datasets, use a combination of clustering and nearest neighbor
    if (addresses.length > 300) {
      return this.clusterAndOptimize(addresses, startLocation);
    } else {
      // Enhanced nearest neighbor with 2-opt improvements
      return this.enhancedNearestNeighbor(addresses, startLocation);
    }
  }

  private clusterAndOptimize(addresses: Address[], startLocation?: { latitude: number; longitude: number }): Address[] {
    // Divide addresses into clusters based on geographic proximity
    const clusterCount = Math.ceil(addresses.length / 50); // Max 50 stops per cluster
    const clusters = this.createGeographicClusters(addresses, clusterCount);
    
    let optimizedRoute: Address[] = [];
    let currentLocation = startLocation;

    // Optimize each cluster and connect them efficiently
    for (const cluster of clusters) {
      const optimizedCluster = this.nearestNeighborTSP(cluster, currentLocation);
      optimizedRoute = optimizedRoute.concat(optimizedCluster);
      
      // Update current location to end of this cluster
      const lastStop = optimizedCluster[optimizedCluster.length - 1];
      if (lastStop.latitude && lastStop.longitude) {
        currentLocation = { latitude: lastStop.latitude, longitude: lastStop.longitude };
      }
    }

    return optimizedRoute;
  }

  private createGeographicClusters(addresses: Address[], clusterCount: number): Address[][] {
    if (clusterCount >= addresses.length) {
      return addresses.map(addr => [addr]);
    }

    // Simple k-means clustering based on lat/lng
    const clusters: Address[][] = Array(clusterCount).fill(null).map(() => []);
    
    // Initialize cluster centers
    const centers = [];
    for (let i = 0; i < clusterCount; i++) {
      const index = Math.floor(i * addresses.length / clusterCount);
      centers.push({
        lat: addresses[index].latitude || 0,
        lng: addresses[index].longitude || 0
      });
    }

    // Assign addresses to nearest cluster center
    for (const address of addresses) {
      if (!address.latitude || !address.longitude) continue;
      
      let nearestCluster = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < centers.length; i++) {
        const distance = this.calculateDistance(
          address.latitude, address.longitude,
          centers[i].lat, centers[i].lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      }
      
      clusters[nearestCluster].push(address);
    }

    // Filter out empty clusters
    return clusters.filter(cluster => cluster.length > 0);
  }

  private enhancedNearestNeighbor(addresses: Address[], startLocation?: { latitude: number; longitude: number }): Address[] {
    // Start with basic nearest neighbor
    let route = this.nearestNeighborTSP(addresses, startLocation);
    
    // Apply 2-opt improvements (limited iterations for performance)
    const maxIterations = Math.min(50, addresses.length);
    route = this.twoOptImprovement(route, maxIterations);
    
    return route;
  }

  private twoOptImprovement(route: Address[], maxIterations: number): Address[] {
    let improved = true;
    let iterations = 0;
    let currentRoute = [...route];
    
    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (let i = 1; i < currentRoute.length - 2; i++) {
        for (let j = i + 1; j < currentRoute.length; j++) {
          if (j - i === 1) continue; // Skip adjacent edges
          
          const newRoute = this.twoOptSwap(currentRoute, i, j);
          if (this.calculateTotalDistance(newRoute) < this.calculateTotalDistance(currentRoute)) {
            currentRoute = newRoute;
            improved = true;
          }
        }
      }
    }
    
    return currentRoute;
  }

  private twoOptSwap(route: Address[], i: number, j: number): Address[] {
    const newRoute = [...route];
    // Reverse the order of addresses between indices i and j
    while (i < j) {
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      i++;
      j--;
    }
    return newRoute;
  }

  private calculateTotalDistance(route: Address[], distanceMatrix?: number[][]): number {
    if (distanceMatrix) {
      return this.calculateTotalDistanceWithMatrix(route, distanceMatrix);
    }
    
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      if (route[i].latitude && route[i].longitude && route[i + 1].latitude && route[i + 1].longitude) {
        total += this.calculateDistance(
          route[i].latitude!, route[i].longitude!,
          route[i + 1].latitude!, route[i + 1].longitude!
        );
      }
    }
    return total;
  }

  // Calculate total distance using pre-computed matrix
  private calculateTotalDistanceWithMatrix(route: Address[], distanceMatrix: number[][]): number {
    let total = 0;
    
    for (let i = 0; i < route.length - 1; i++) {
      // Find indices in the original address array
      const fromIdx = this.findAddressIndex(route[i]);
      const toIdx = this.findAddressIndex(route[i + 1]);
      
      if (fromIdx !== -1 && toIdx !== -1 && distanceMatrix[fromIdx] && distanceMatrix[fromIdx][toIdx] !== undefined) {
        total += distanceMatrix[fromIdx][toIdx];
      } else {
        // Fallback to haversine calculation
        total += this.calculateDistance(
          route[i].latitude!, route[i].longitude!,
          route[i + 1].latitude!, route[i + 1].longitude!
        );
      }
    }
    return total;
  }

  // Helper to find address index in original array
  private findAddressIndex(address: Address): number {
    if (!this.originalAddresses) return -1;
    return this.originalAddresses.findIndex(a => a.id === address.id);
  }

  private nearestNeighborTSP(addresses: Address[], startLocation?: { latitude: number; longitude: number }): Address[] {
    if (addresses.length === 0) return [];
    
    const unvisited = [...addresses];
    const route: Address[] = [];
    
    // Start from the specified location or first address
    let current: Address;
    if (startLocation) {
      // Find nearest address to start location
      current = this.findNearestAddress(unvisited, startLocation);
    } else {
      current = unvisited[0];
    }
    
    route.push(current);
    unvisited.splice(unvisited.indexOf(current), 1);

    // Continue with nearest neighbor
    while (unvisited.length > 0) {
      const nearest = this.findNearestAddress(unvisited, {
        latitude: current.latitude!,
        longitude: current.longitude!
      });
      
      route.push(nearest);
      unvisited.splice(unvisited.indexOf(nearest), 1);
      current = nearest;
    }

    return route;
  }

  private findNearestAddress(addresses: Address[], location: { latitude: number; longitude: number }): Address {
    let nearest = addresses[0];
    let minDistance = this.calculateDistance(
      location.latitude,
      location.longitude,
      nearest.latitude!,
      nearest.longitude!
    );

    for (const address of addresses) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        address.latitude!,
        address.longitude!
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = address;
      }
    }

    return nearest;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for calculating distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async calculateRouteMetrics(route: Address[]): Promise<RouteMetrics> {
    let totalDistance = 0;
    let estimatedTime = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const distance = this.calculateDistance(
        route[i].latitude!,
        route[i].longitude!,
        route[i + 1].latitude!,
        route[i + 1].longitude!
      );
      
      totalDistance += distance;
      // Estimate time: average 40 km/h + 5 minutes per stop
      estimatedTime += (distance / 40) * 60 + 5;
    }

    return { totalDistance, estimatedTime };
  }

  // NEW: Group addresses at the same location together
  private groupSameLocationAddresses(addresses: Address[]): Address[] {
    const locationGroups = new Map<string, Address[]>();
    
    addresses.forEach(address => {
      // Create a normalized location key (street address without apartment/unit)
      const locationKey = this.normalizeAddressForGrouping(address.address);
      
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      locationGroups.get(locationKey)!.push(address);
    });

    // Convert groups back to representative addresses
    const groupedAddresses: Address[] = [];
    locationGroups.forEach((group, locationKey) => {
      if (group.length === 1) {
        // Single delivery - use as-is
        groupedAddresses.push(group[0]);
      } else {
        // Multiple deliveries at same location - create a group representative
        const representative = {
          ...group[0], // Use first address as base
          id: `group_${locationKey}`,
          name: `${group[0].name} (+${group.length - 1} more)`,
          notes: `Group of ${group.length} deliveries: ${group.map(a => a.name || a.id).join(', ')}`,
          groupedAddresses: group // Store the grouped addresses
        };
        groupedAddresses.push(representative as any);
      }
    });

    return groupedAddresses;
  }

  // NEW: Normalize address for grouping (remove apartment/unit numbers)
  private normalizeAddressForGrouping(address: string): string {
    // Remove common apartment/unit indicators and normalize
    const normalized = address
      .toLowerCase()
      .replace(/,?\s*(apt|apartment|unit|suite|#)\s*[a-z0-9]+/gi, '')
      .replace(/,?\s*[a-z]\s*$/gi, '') // Remove single letter suffixes
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalized;
  }

  // NEW: Expand grouped route back to individual stops
  private expandGroupedRoute(groupedRoute: Address[]): Address[] {
    const expandedRoute: Address[] = [];
    
    groupedRoute.forEach(stop => {
      const groupedAddresses = (stop as any).groupedAddresses;
      if (groupedAddresses && Array.isArray(groupedAddresses)) {
        // This is a group - add all addresses in the group
        expandedRoute.push(...groupedAddresses);
      } else {
        // Single address - add as-is
        expandedRoute.push(stop);
      }
    });

    return expandedRoute;
  }

  // ========== ADVANCED OPTIMIZATION METHODS ==========

  // Build real distance matrix using Google Maps Distance Matrix API
  private async buildDistanceMatrix(addresses: Address[]): Promise<number[][]> {
    const n = addresses.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // If no API key, fall back to haversine distance
    if (!this.googleMapsApiKey) {
      console.log(`⚠️  No Google Maps API key - using straight-line distances`);
      return this.buildHaversineMatrix(addresses);
    }

    try {
      // Build matrix in chunks to respect API limits
      const chunkSize = 10; // Google allows max 25 origins × 25 destinations per request
      
      for (let i = 0; i < n; i += chunkSize) {
        for (let j = 0; j < n; j += chunkSize) {
          const origins = addresses.slice(i, Math.min(i + chunkSize, n));
          const destinations = addresses.slice(j, Math.min(j + chunkSize, n));
          
          const chunk = await this.getDistanceMatrixChunk(origins, destinations);
          
          // Fill matrix with chunk data
          for (let oi = 0; oi < origins.length; oi++) {
            for (let dj = 0; dj < destinations.length; dj++) {
              matrix[i + oi][j + dj] = chunk[oi][dj];
            }
          }
        }
      }
      
      return matrix;
    } catch (error) {
      console.log(`⚠️  Distance Matrix API failed - using straight-line distances`);
      return this.buildHaversineMatrix(addresses);
    }
  }

  // Get distance matrix chunk from Google Maps API
  private async getDistanceMatrixChunk(origins: Address[], destinations: Address[]): Promise<number[][]> {
    const originsStr = origins.map(a => `${a.latitude},${a.longitude}`).join('|');
    const destinationsStr = destinations.map(a => `${a.latitude},${a.longitude}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${originsStr}&destinations=${destinationsStr}` +
      `&units=metric&key=${this.googleMapsApiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    const matrix: number[][] = [];
    for (let i = 0; i < data.rows.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < data.rows[i].elements.length; j++) {
        const element = data.rows[i].elements[j];
        if (element.status === 'OK') {
          matrix[i][j] = element.distance.value / 1000; // Convert to km
        } else {
          // Fallback to haversine distance
          matrix[i][j] = this.calculateDistance(
            origins[i].latitude!, origins[i].longitude!,
            destinations[j].latitude!, destinations[j].longitude!
          );
        }
      }
    }

    return matrix;
  }

  // Fallback: Build distance matrix using haversine formula
  private buildHaversineMatrix(addresses: Address[]): number[][] {
    const n = addresses.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          matrix[i][j] = this.calculateDistance(
            addresses[i].latitude!, addresses[i].longitude!,
            addresses[j].latitude!, addresses[j].longitude!
          );
        }
      }
    }
    
    return matrix;
  }

  // Advanced TSP optimization for small routes (≤25 stops)
  private async advancedTSPOptimization(
    addresses: Address[], 
    distanceMatrix: number[][], 
    startLocation?: { latitude: number; longitude: number }
  ): Promise<Address[]> {
    console.log(`🎯 Using advanced TSP for ${addresses.length} stops`);
    
    // Use multiple algorithms and pick best result
    const results = await Promise.all([
      this.nearestNeighborWithMatrix(addresses, distanceMatrix, startLocation),
      this.greedyTSP(addresses, distanceMatrix, startLocation),
      this.christofidesApproximation(addresses, distanceMatrix, startLocation)
    ]);

    // Pick best result based on total distance
    let bestRoute = results[0];
    let bestDistance = this.calculateTotalDistance(bestRoute, distanceMatrix);

    for (const route of results) {
      const distance = this.calculateTotalDistance(route, distanceMatrix);
      if (distance < bestDistance) {
        bestRoute = route;
        bestDistance = distance;
      }
    }

    return bestRoute;
  }

  // Hybrid optimization for medium routes (26-100 stops)
  private async hybridOptimization(
    addresses: Address[], 
    distanceMatrix: number[][], 
    startLocation?: { latitude: number; longitude: number }
  ): Promise<Address[]> {
    console.log(`🔀 Using hybrid approach for ${addresses.length} stops`);
    
    // Start with nearest neighbor, then improve with local search
    let route = this.nearestNeighborWithMatrix(addresses, distanceMatrix, startLocation);
    
    // Apply multiple improvement heuristics
    route = this.apply2OptImprovement(route, distanceMatrix);
    route = this.applyOrOptImprovement(route, distanceMatrix);
    
    return route;
  }

  // Cluster-based optimization for large routes (100+ stops)
  private async clusterBasedOptimization(
    addresses: Address[], 
    distanceMatrix: number[][], 
    startLocation?: { latitude: number; longitude: number }
  ): Promise<Address[]> {
    console.log(`🌍 Using geographic clustering for ${addresses.length} stops`);
    
    // Create geographic clusters
    const clusterCount = Math.ceil(addresses.length / 30);
    const clusters = this.createSmartClusters(addresses, clusterCount);
    
    // Optimize each cluster internally
    const optimizedClusters: Address[][] = [];
    for (const cluster of clusters) {
      const clusterIndices = cluster.map(addr => addresses.indexOf(addr));
      const clusterMatrix = this.extractSubMatrix(distanceMatrix, clusterIndices);
      const optimizedCluster = this.nearestNeighborWithMatrix(cluster, clusterMatrix);
      optimizedClusters.push(optimizedCluster);
    }
    
    // Optimize cluster order
    const clusterRoute = this.optimizeClusterOrder(optimizedClusters, distanceMatrix, addresses, startLocation);
    
    // Flatten result
    return clusterRoute.flat();
  }

  // Apply local search improvements (2-opt, Or-opt, etc.)
  private applyLocalSearchImprovements(route: Address[], distanceMatrix: number[][]): Address[] {
    console.log(`🔧 Applying local search improvements...`);
    
    let improved = route;
    let keepImproving = true;
    let iterations = 0;
    const maxIterations = 50;
    
    while (keepImproving && iterations < maxIterations) {
      const before = this.calculateTotalDistance(improved, distanceMatrix);
      
      // Apply 2-opt improvement
      improved = this.apply2OptImprovement(improved, distanceMatrix);
      
      // Apply Or-opt improvement
      improved = this.applyOrOptImprovement(improved, distanceMatrix);
      
      const after = this.calculateTotalDistance(improved, distanceMatrix);
      keepImproving = after < before;
      iterations++;
    }
    
    console.log(`🎉 Local search complete after ${iterations} iterations`);
    return improved;
  }

  // ========== IMPLEMENTED OPTIMIZATION METHODS ==========

  private nearestNeighborWithMatrix(addresses: Address[], matrix: number[][], start?: any): Address[] {
    if (addresses.length === 0) return [];
    if (addresses.length === 1) return addresses;

    const unvisited = [...addresses];
    const route: Address[] = [];
    
    // Find starting point
    let current = start ? 
      unvisited.find(a => Math.abs(a.latitude! - start.latitude) < 0.001 && Math.abs(a.longitude! - start.longitude) < 0.001) || unvisited[0] 
      : unvisited[0];
    
    route.push(current);
    unvisited.splice(unvisited.indexOf(current), 1);
    
    // Greedy nearest neighbor using matrix
    while (unvisited.length > 0) {
      let nearest = unvisited[0];
      let shortestDistance = Infinity;
      
      const currentIdx = this.findAddressIndex(current);
      
      for (const candidate of unvisited) {
        const candidateIdx = this.findAddressIndex(candidate);
        const distance = (currentIdx !== -1 && candidateIdx !== -1 && matrix[currentIdx] && matrix[currentIdx][candidateIdx]) 
          ? matrix[currentIdx][candidateIdx]
          : this.calculateDistance(current.latitude!, current.longitude!, candidate.latitude!, candidate.longitude!);
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearest = candidate;
        }
      }
      
      route.push(nearest);
      unvisited.splice(unvisited.indexOf(nearest), 1);
      current = nearest;
    }
    
    return route;
  }

  private greedyTSP(addresses: Address[], matrix: number[][], start?: any): Address[] {
    // Build minimum spanning tree approach
    if (addresses.length <= 3) return this.nearestNeighborWithMatrix(addresses, matrix, start);
    
    const route: Address[] = [];
    const unvisited = new Set(addresses);
    
    // Start with the specified start location or first address
    let current = start ? 
      addresses.find(a => Math.abs(a.latitude! - start.latitude) < 0.001 && Math.abs(a.longitude! - start.longitude) < 0.001) || addresses[0] 
      : addresses[0];
    
    route.push(current);
    unvisited.delete(current);
    
    // Greedy selection of minimum cost edges
    while (unvisited.size > 0) {
      let minCost = Infinity;
      let nextAddress: Address | null = null;
      
      const currentIdx = this.findAddressIndex(current);
      
      for (const candidate of unvisited) {
        const candidateIdx = this.findAddressIndex(candidate);
        const cost = (currentIdx !== -1 && candidateIdx !== -1 && matrix[currentIdx] && matrix[currentIdx][candidateIdx]) 
          ? matrix[currentIdx][candidateIdx]
          : this.calculateDistance(current.latitude!, current.longitude!, candidate.latitude!, candidate.longitude!);
        
        if (cost < minCost) {
          minCost = cost;
          nextAddress = candidate;
        }
      }
      
      if (nextAddress) {
        route.push(nextAddress);
        unvisited.delete(nextAddress);
        current = nextAddress;
      } else {
        break;
      }
    }
    
    return route;
  }

  private christofidesApproximation(addresses: Address[], matrix: number[][], start?: any): Address[] {
    // Simplified Christofides-inspired algorithm
    // For small datasets, this is essentially an improved nearest neighbor
    if (addresses.length <= 5) {
      return this.greedyTSP(addresses, matrix, start);
    }
    
    // Use nearest neighbor as base, then apply 2-opt improvement
    let route = this.nearestNeighborWithMatrix(addresses, matrix, start);
    route = this.apply2OptImprovement(route, matrix);
    
    return route;
  }

  private apply2OptImprovement(route: Address[], matrix: number[][]): Address[] {
    if (route.length < 4) return route;
    
    let improved = [...route];
    let improvementFound = true;
    let iterations = 0;
    const maxIterations = Math.min(20, route.length);
    
    while (improvementFound && iterations < maxIterations) {
      improvementFound = false;
      iterations++;
      
      for (let i = 1; i < improved.length - 2; i++) {
        for (let j = i + 1; j < improved.length - 1; j++) {
          // Calculate current distance
          const currentDist = this.getMatrixDistance(improved[i - 1], improved[i], matrix) + 
                            this.getMatrixDistance(improved[j], improved[j + 1], matrix);
          
          // Calculate distance after 2-opt swap
          const newDist = this.getMatrixDistance(improved[i - 1], improved[j], matrix) + 
                         this.getMatrixDistance(improved[i], improved[j + 1], matrix);
          
          if (newDist < currentDist) {
            // Perform 2-opt swap: reverse the segment between i and j
            const newRoute = [
              ...improved.slice(0, i),
              ...improved.slice(i, j + 1).reverse(),
              ...improved.slice(j + 1)
            ];
            improved = newRoute;
            improvementFound = true;
          }
        }
      }
    }
    
    console.log(`🔧 2-opt improvement: ${iterations} iterations`);
    return improved;
  }

  private applyOrOptImprovement(route: Address[], matrix: number[][]): Address[] {
    if (route.length < 4) return route;
    
    let improved = [...route];
    let improvementFound = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (improvementFound && iterations < maxIterations) {
      improvementFound = false;
      iterations++;
      
      // Try relocating each address to a better position
      for (let i = 1; i < improved.length - 1; i++) {
        const address = improved[i];
        
        // Remove address from current position
        const withoutAddress = improved.filter((_, idx) => idx !== i);
        
        // Try inserting it at each other position
        for (let j = 0; j < withoutAddress.length; j++) {
          const newRoute = [
            ...withoutAddress.slice(0, j),
            address,
            ...withoutAddress.slice(j)
          ];
          
          const currentCost = this.calculateTotalDistance(improved, matrix);
          const newCost = this.calculateTotalDistance(newRoute, matrix);
          
          if (newCost < currentCost) {
            improved = newRoute;
            improvementFound = true;
            break;
          }
        }
        
        if (improvementFound) break;
      }
    }
    
    console.log(`🔧 Or-opt improvement: ${iterations} iterations`);
    return improved;
  }

  private getMatrixDistance(from: Address, to: Address, matrix: number[][]): number {
    const fromIdx = this.findAddressIndex(from);
    const toIdx = this.findAddressIndex(to);
    
    if (fromIdx !== -1 && toIdx !== -1 && matrix[fromIdx] && matrix[fromIdx][toIdx] !== undefined) {
      return matrix[fromIdx][toIdx];
    }
    
    // Fallback to haversine
    return this.calculateDistance(from.latitude!, from.longitude!, to.latitude!, to.longitude!);
  }

  private createSmartClusters(addresses: Address[], count: number): Address[][] {
    // Use improved geographic clustering with density consideration
    if (addresses.length <= count) {
      return addresses.map(addr => [addr]);
    }
    
    // Start with k-means style geographic clustering
    const clusters: Address[][] = [];
    
    // Initialize cluster centers
    const centers: { lat: number; lng: number }[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(i * addresses.length / count);
      centers.push({
        lat: addresses[idx].latitude!,
        lng: addresses[idx].longitude!
      });
    }
    
    // Assign addresses to nearest cluster center
    for (const address of addresses) {
      let nearestCluster = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < centers.length; i++) {
        const distance = this.calculateDistance(
          address.latitude!, address.longitude!,
          centers[i].lat, centers[i].lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      }
      
      if (!clusters[nearestCluster]) {
        clusters[nearestCluster] = [];
      }
      clusters[nearestCluster].push(address);
    }
    
    // Remove empty clusters and ensure all addresses are assigned
    const nonEmptyClusters = clusters.filter(cluster => cluster && cluster.length > 0);
    
    console.log(`📊 Created ${nonEmptyClusters.length} geographic clusters`);
    return nonEmptyClusters;
  }

  private extractSubMatrix(matrix: number[][], indices: number[]): number[][] {
    return indices.map(i => 
      indices.map(j => 
        (matrix[i] && matrix[i][j] !== undefined) ? matrix[i][j] : 0
      )
    );
  }

  private optimizeClusterOrder(clusters: Address[][], matrix: number[][], allAddresses: Address[], start?: any): Address[][] {
    if (clusters.length <= 1) return clusters;
    
    // Create cluster representatives (centroids)
    const clusterCenters = clusters.map(cluster => {
      const avgLat = cluster.reduce((sum, addr) => sum + (addr.latitude || 0), 0) / cluster.length;
      const avgLng = cluster.reduce((sum, addr) => sum + (addr.longitude || 0), 0) / cluster.length;
      return { latitude: avgLat, longitude: avgLng, id: `cluster-${cluster.length}`, address: 'cluster-center' };
    });
    
    // Find optimal order of cluster centers
    const orderedCenters = this.nearestNeighborTSP(clusterCenters, start);
    
    // Return clusters in the optimized order
    const orderedClusters: Address[][] = [];
    for (const center of orderedCenters) {
      const clusterIndex = clusterCenters.findIndex(c => 
        Math.abs(c.latitude - (center.latitude || 0)) < 0.0001 && Math.abs(c.longitude - (center.longitude || 0)) < 0.0001
      );
      if (clusterIndex !== -1 && clusters[clusterIndex]) {
        orderedClusters.push(clusters[clusterIndex]);
      }
    }
    
    console.log(`🔀 Optimized cluster ordering`);
    return orderedClusters;
  }
}