import fs from 'fs';
import path from 'path';

interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  skippedAt?: string;
}

interface SavedRoute {
  id: string;
  name: string;
  addresses: Address[];
  totalDistance: number;
  estimatedTime: number;
  createdAt: string;
  lastModified: string;
  isActive?: boolean;
  currentStepIndex: number;
}

export class RouteStorageService {
  private readonly dataDir: string;
  private readonly routesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.routesFile = path.join(this.dataDir, 'routes.json');
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.routesFile)) {
      fs.writeFileSync(this.routesFile, JSON.stringify([], null, 2));
    }
  }

  private readRoutes(): SavedRoute[] {
    try {
      const data = fs.readFileSync(this.routesFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      console.error('Error reading routes file:', error);
      return [];
    }
  }

  private writeRoutes(routes: SavedRoute[]): void {
    try {
      fs.writeFileSync(this.routesFile, JSON.stringify(routes, null, 2));
    } catch (error) {
      console.error('Error writing routes file:', error);
      throw new Error('Failed to save routes');
    }
  }

  saveRoute(route: Omit<SavedRoute, 'id' | 'createdAt' | 'lastModified'>): SavedRoute {
    const routes = this.readRoutes();
    
    const newRoute: SavedRoute = {
      ...route,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    routes.push(newRoute);
    this.writeRoutes(routes);
    
    return newRoute;
  }

  updateRoute(routeId: string, updates: Partial<SavedRoute>): SavedRoute | null {
    const routes = this.readRoutes();
    const routeIndex = routes.findIndex(r => r.id === routeId);
    
    if (routeIndex === -1) {
      return null;
    }

    routes[routeIndex] = {
      ...routes[routeIndex],
      ...updates,
      lastModified: new Date().toISOString()
    };

    this.writeRoutes(routes);
    return routes[routeIndex];
  }

  getRoute(routeId: string): SavedRoute | null {
    const routes = this.readRoutes();
    return routes.find(r => r.id === routeId) || null;
  }

  getAllRoutes(): SavedRoute[] {
    return this.readRoutes().sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  deleteRoute(routeId: string): boolean {
    const routes = this.readRoutes();
    const initialLength = routes.length;
    const filteredRoutes = routes.filter(r => r.id !== routeId);
    
    if (filteredRoutes.length < initialLength) {
      this.writeRoutes(filteredRoutes);
      return true;
    }
    return false;
  }

  addStopToRoute(routeId: string, address: Address, insertIndex?: number): SavedRoute | null {
    const route = this.getRoute(routeId);
    if (!route) return null;

    const newAddress = {
      ...address,
      id: address.id || this.generateId(),
      status: 'pending' as const
    };

    if (insertIndex !== undefined && insertIndex >= 0) {
      route.addresses.splice(insertIndex, 0, newAddress);
    } else {
      route.addresses.push(newAddress);
    }

    return this.updateRoute(routeId, route);
  }

  removeStopFromRoute(routeId: string, addressId: string): SavedRoute | null {
    const route = this.getRoute(routeId);
    if (!route) return null;

    route.addresses = route.addresses.filter(addr => addr.id !== addressId);
    return this.updateRoute(routeId, route);
  }

  updateStopStatus(
    routeId: string, 
    addressId: string, 
    status: 'pending' | 'completed' | 'skipped'
  ): SavedRoute | null {
    const route = this.getRoute(routeId);
    if (!route) return null;

    const addressIndex = route.addresses.findIndex(addr => addr.id === addressId);
    if (addressIndex === -1) return null;

    const now = new Date().toISOString();
    route.addresses[addressIndex] = {
      ...route.addresses[addressIndex],
      status,
      ...(status === 'completed' ? { completedAt: now } : {}),
      ...(status === 'skipped' ? { skippedAt: now } : {})
    };

    return this.updateRoute(routeId, route);
  }

  getActiveRoute(): SavedRoute | null {
    const routes = this.readRoutes();
    return routes.find(r => r.isActive) || null;
  }

  setActiveRoute(routeId: string): SavedRoute | null {
    const routes = this.readRoutes();
    
    // Clear all active flags
    routes.forEach(route => route.isActive = false);
    
    // Set the specified route as active
    const targetRoute = routes.find(r => r.id === routeId);
    if (targetRoute) {
      targetRoute.isActive = true;
      this.writeRoutes(routes);
      return targetRoute;
    }
    
    return null;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}