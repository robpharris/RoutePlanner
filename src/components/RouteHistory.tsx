import React, { useState, useEffect } from 'react';

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

interface RouteHistoryProps {
  onRouteSelect: (route: SavedRoute) => void;
  currentRouteId?: string;
}

const RouteHistory: React.FC<RouteHistoryProps> = ({ onRouteSelect, currentRouteId }) => {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/routes');
      if (response.ok) {
        const routesData = await response.json();
        setRoutes(routesData);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/routes/${routeId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchRoutes();
        setShowDeleteConfirm(null);
      } else {
        alert('Failed to delete route');
      }
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Error deleting route');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRouteStats = (route: SavedRoute) => {
    const completed = route.addresses.filter(addr => addr.status === 'completed').length;
    const skipped = route.addresses.filter(addr => addr.status === 'skipped').length;
    const total = route.addresses.length;
    const pending = total - completed - skipped;
    
    return { completed, skipped, pending, total };
  };

  if (isLoading) {
    return (
      <div className="route-history loading">
        <div className="spinner"></div>
        <p>Loading routes...</p>
      </div>
    );
  }

  return (
    <div className="route-history">
      <div className="route-history-header">
        <h3>📋 Saved Routes</h3>
        <button onClick={fetchRoutes} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="no-routes">
          <p>No saved routes found. Create your first route by uploading addresses and optimizing!</p>
        </div>
      ) : (
        <div className="routes-list">
          {routes.map((route) => {
            const stats = getRouteStats(route);
            return (
              <div
                key={route.id}
                className={`route-card ${route.id === currentRouteId ? 'current' : ''} ${route.isActive ? 'active' : ''}`}
              >
                <div className="route-card-header">
                  <div className="route-name">
                    {route.name}
                    {route.isActive && <span className="active-badge">Active</span>}
                  </div>
                  <div className="route-actions">
                    <button
                      onClick={() => onRouteSelect(route)}
                      className="select-route-btn"
                      title="Load this route"
                    >
                      📂
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(route.id)}
                      className="delete-route-btn"
                      title="Delete route"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="route-stats">
                  <div className="stat">
                    <span className="stat-number">{stats.total}</span>
                    <span className="stat-label">Stops</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{stats.completed}</span>
                    <span className="stat-label">Done</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{stats.skipped}</span>
                    <span className="stat-label">Skipped</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{stats.pending}</span>
                    <span className="stat-label">Pending</span>
                  </div>
                </div>

                <div className="route-progress-bar">
                  <div className="progress-segment completed" style={{ width: `${(stats.completed / stats.total) * 100}%` }}></div>
                  <div className="progress-segment skipped" style={{ width: `${(stats.skipped / stats.total) * 100}%` }}></div>
                </div>

                <div className="route-details">
                  <div className="route-meta">
                    <span>{route.totalDistance.toFixed(1)} km</span>
                    <span>{Math.round(route.estimatedTime)} min</span>
                    <span>Modified: {formatDate(route.lastModified)}</span>
                  </div>
                </div>

                {showDeleteConfirm === route.id && (
                  <div className="delete-confirm">
                    <p>Delete "{route.name}"?</p>
                    <div className="delete-actions">
                      <button onClick={() => deleteRoute(route.id)} className="confirm-delete">
                        Yes, Delete
                      </button>
                      <button onClick={() => setShowDeleteConfirm(null)} className="cancel-delete">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RouteHistory;