import React from 'react';

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

interface RouteDisplayProps {
  routeData: RouteData;
  currentStep: number;
  onStepChange: (step: number) => void;
  onStopStatusChange: (addressId: string, status: 'pending' | 'completed' | 'skipped') => void;
  routeId?: string;
}

const RouteDisplay: React.FC<RouteDisplayProps> = ({ 
  routeData, 
  currentStep, 
  onStepChange,
  onStopStatusChange,
  routeId
}) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleStatusChange = async (addressId: string, newStatus: 'pending' | 'completed' | 'skipped') => {
    if (routeId) {
      try {
        const response = await fetch(`http://localhost:3001/api/routes/${routeId}/stops/${addressId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
          onStopStatusChange(addressId, newStatus);
        } else {
          throw new Error('Failed to update status');
        }
      } catch (error) {
        console.error('Error updating stop status:', error);
        alert('Failed to update stop status');
      }
    } else {
      onStopStatusChange(addressId, newStatus);
    }
  };

  const getStatusStats = () => {
    const completed = routeData.optimizedRoute.filter(addr => addr.status === 'completed').length;
    const skipped = routeData.optimizedRoute.filter(addr => addr.status === 'skipped').length;
    const pending = routeData.optimizedRoute.length - completed - skipped;
    
    return { completed, skipped, pending, total: routeData.optimizedRoute.length };
  };

  const stats = getStatusStats();

  return (
    <div className="route-display">
      <div className="route-summary">
        <h2>📍 Optimized Route</h2>
        <div className="route-stats">
          <div className="stat">
            <span className="stat-label">Total Distance:</span>
            <span className="stat-value">{routeData.totalDistance} km</span>
          </div>
          <div className="stat">
            <span className="stat-label">Estimated Time:</span>
            <span className="stat-value">{formatTime(routeData.estimatedTime)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Stops:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        
        <div className="progress-stats">
          <div className="progress-stat completed">
            <span className="progress-number">{stats.completed}</span>
            <span className="progress-label">Completed</span>
          </div>
          <div className="progress-stat skipped">
            <span className="progress-number">{stats.skipped}</span>
            <span className="progress-label">Skipped</span>
          </div>
          <div className="progress-stat pending">
            <span className="progress-number">{stats.pending}</span>
            <span className="progress-label">Pending</span>
          </div>
        </div>
      </div>

      <div className="route-steps">
        <h3>Route Steps</h3>
        <div className="steps-list">
          {routeData.optimizedRoute.map((address, index) => (
            <div 
              key={address.id}
              className={`step ${address.status || 'pending'} ${index === currentStep ? 'current' : ''}`}
            >
              <div className="step-number">
                {address.status === 'completed' && '✅'}
                {address.status === 'skipped' && '⏭️'}
                {address.status === 'pending' && (index + 1)}
              </div>
              
              <div className="step-content" onClick={() => onStepChange(index)}>
                <div className="step-header">
                  {address.name && (
                    <span className="customer-name">{address.name}</span>
                  )}
                  <span className={`step-status ${address.status || 'pending'}`}>
                    {address.status === 'completed' && 'Completed'}
                    {address.status === 'skipped' && 'Skipped'}
                    {address.status === 'pending' && (index === currentStep ? 'Current' : 'Pending')}
                  </span>
                </div>
                <div className="step-address">{address.address}</div>
                {address.notes && (
                  <div className="step-notes">📝 {address.notes}</div>
                )}
                {address.completedAt && (
                  <div className="step-timestamp">
                    ✅ {new Date(address.completedAt).toLocaleString()}
                  </div>
                )}
                {address.skippedAt && (
                  <div className="step-timestamp">
                    ⏭️ {new Date(address.skippedAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="step-actions">
                {address.status !== 'completed' && (
                  <button
                    onClick={() => handleStatusChange(address.id, 'completed')}
                    className="status-btn complete-btn"
                    title="Mark as completed"
                  >
                    ✅
                  </button>
                )}
                
                {address.status !== 'skipped' && (
                  <button
                    onClick={() => handleStatusChange(address.id, 'skipped')}
                    className="status-btn skip-btn"
                    title="Skip this stop"
                  >
                    ⏭️
                  </button>
                )}
                
                {(address.status === 'completed' || address.status === 'skipped') && (
                  <button
                    onClick={() => handleStatusChange(address.id, 'pending')}
                    className="status-btn reset-btn"
                    title="Reset to pending"
                  >
                    ↩️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RouteDisplay;