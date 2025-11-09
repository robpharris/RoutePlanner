import { useState } from 'react'
import FileUpload from './components/FileUpload'
import RouteDisplay from './components/RouteDisplay'
import NavigationPanel from './components/NavigationPanel'
import RouteHistory from './components/RouteHistory'
import StopManagement from './components/StopManagement'
import './App.css'

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

interface RouteData {
  optimizedRoute: Address[];
  totalDistance: number;
  estimatedTime: number;
  navigationUrls: {
    googleMaps: string;
    waze: string;
  };
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

function App() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRoute, setCurrentRoute] = useState<SavedRoute | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'manage'>('upload');
  const [routeName, setRouteName] = useState('');

  const handleAddressesUploaded = (uploadedAddresses: Address[]) => {
    setAddresses(uploadedAddresses);
    setRouteData(null);
    setCurrentStep(0);
  };
  

  const handleOptimizeRoute = async () => {
    if (addresses.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3003/api/optimize-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize route');
      }

      const data: RouteData = await response.json();
      setRouteData(data);
    } catch (error) {
      console.error('Error optimizing route:', error);
      alert('Failed to optimize route. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeData || !routeName.trim()) {
      alert('Please enter a route name');
      return;
    }

    try {
      const response = await fetch('http://localhost:3003/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: routeName,
          addresses: routeData.optimizedRoute,
          totalDistance: routeData.totalDistance,
          estimatedTime: routeData.estimatedTime,
          currentStepIndex: currentStep
        })
      });

      if (response.ok) {
        const savedRoute = await response.json();
        setCurrentRoute(savedRoute);
        alert('Route saved successfully!');
        setRouteName('');
      } else {
        throw new Error('Failed to save route');
      }
    } catch (error) {
      console.error('Error saving route:', error);
      alert('Failed to save route');
    }
  };

  const handleLoadRoute = (route: SavedRoute) => {
    setCurrentRoute(route);
    setAddresses(route.addresses);
    setCurrentStep(route.currentStepIndex || 0);
    
    // Reconstruct route data
    setRouteData({
      optimizedRoute: route.addresses,
      totalDistance: route.totalDistance,
      estimatedTime: route.estimatedTime,
      navigationUrls: { googleMaps: '', waze: '' } // Will be generated when needed
    });
    
    setActiveTab('upload');
  };

  const handleStopStatusChange = (addressId: string, status: 'pending' | 'completed' | 'skipped') => {
    // Update local state
    setAddresses(prevAddresses => 
      prevAddresses.map(addr => 
        addr.id === addressId 
          ? { 
              ...addr, 
              status,
              ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
              ...(status === 'skipped' ? { skippedAt: new Date().toISOString() } : {})
            }
          : addr
      )
    );

    // Also update route data if it exists
    if (routeData) {
      setRouteData(prevRouteData => ({
        ...prevRouteData!,
        optimizedRoute: prevRouteData!.optimizedRoute.map(addr => 
          addr.id === addressId 
            ? { 
                ...addr, 
                status,
                ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
                ...(status === 'skipped' ? { skippedAt: new Date().toISOString() } : {})
              }
            : addr
        )
      }));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚚 Route Planner Pro</h1>
        <p>Advanced delivery route planning with up to 600 stops</p>
      </header>

      <nav className="app-nav">
        <button 
          className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Upload & Plan
        </button>
        <button 
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 Route History
        </button>
        <button 
          className={`nav-tab ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          ✏️ Manage Stops
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'upload' && (
          <>
            <div className="upload-section">
              <FileUpload onAddressesUploaded={handleAddressesUploaded} />
              
              {addresses.length > 0 && (
                <div className="address-summary">
                  <h3>📍 Addresses Loaded: {addresses.length}</h3>
                  <div className="route-actions">
                    <button 
                      onClick={handleOptimizeRoute} 
                      disabled={isLoading}
                      className="optimize-button"
                    >
                      {isLoading ? 'Optimizing...' : 'Optimize Route'}
                    </button>
                    
                    {routeData && (
                      <div className="save-route">
                        <input
                          type="text"
                          placeholder="Enter route name..."
                          value={routeName}
                          onChange={(e) => setRouteName(e.target.value)}
                          className="route-name-input"
                        />
                        <button onClick={handleSaveRoute} className="save-button">
                          💾 Save Route
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {routeData && (
              <div className="route-section">
                <RouteDisplay 
                  routeData={routeData}
                  currentStep={currentStep}
                  onStepChange={setCurrentStep}
                  onStopStatusChange={handleStopStatusChange}
                  routeId={currentRoute?.id}
                />
                
                <NavigationPanel 
                  route={routeData.optimizedRoute}
                  currentStep={currentStep}
                  navigationUrls={routeData.navigationUrls}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <RouteHistory 
            onRouteSelect={handleLoadRoute}
            currentRouteId={currentRoute?.id}
          />
        )}

        {activeTab === 'manage' && (
          <StopManagement 
            addresses={addresses}
            onAddressesChange={setAddresses}
            routeId={currentRoute?.id}
          />
        )}
      </main>
    </div>
  )
}

export default App
