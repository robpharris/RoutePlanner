import React from 'react';

interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
}

interface NavigationPanelProps {
  route: Address[];
  currentStep: number;
  navigationUrls: {
    googleMaps: string;
    waze: string;
  };
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ 
  route, 
  currentStep, 
  navigationUrls 
}) => {
  const currentAddress = route[currentStep];
  const nextAddress = route[currentStep + 1];

  const openNavigation = (service: 'google-maps' | 'waze') => {
    const params = new URLSearchParams({
      addresses: JSON.stringify(route),
    });

    fetch(`http://localhost:3001/api/navigation/${service}/${currentStep}?${params}`)
      .then(response => response.json())
      .then(data => {
        if (data.url) {
          window.open(data.url, '_blank');
        }
      })
      .catch(error => {
        console.error('Error opening navigation:', error);
        // Fallback to the general navigation URLs
        if (service === 'google-maps' && navigationUrls.googleMaps) {
          window.open(navigationUrls.googleMaps, '_blank');
        } else if (service === 'waze' && navigationUrls.waze) {
          window.open(navigationUrls.waze, '_blank');
        }
      });
  };

  const openFullRoute = () => {
    if (navigationUrls.googleMaps) {
      window.open(navigationUrls.googleMaps, '_blank');
    }
  };

  if (!currentAddress) {
    return (
      <div className="navigation-panel">
        <div className="navigation-content">
          <h3>🎉 Route Complete!</h3>
          <p>All deliveries have been completed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="navigation-panel">
      <div className="navigation-header">
        <h3>🧭 Navigation</h3>
      </div>

      <div className="current-destination">
        <h4>Current Stop ({currentStep + 1} of {route.length})</h4>
        <div className="destination-info">
          {currentAddress.name && (
            <div className="customer-name">{currentAddress.name}</div>
          )}
          <div className="destination-address">{currentAddress.address}</div>
          {currentAddress.notes && (
            <div className="destination-notes">📝 {currentAddress.notes}</div>
          )}
        </div>
      </div>

      {nextAddress && (
        <div className="next-destination">
          <h5>Next Stop:</h5>
          <div className="next-address">
            {nextAddress.name && <span>{nextAddress.name} - </span>}
            {nextAddress.address}
          </div>
        </div>
      )}

      <div className="navigation-buttons">
        <button 
          className="nav-button google-maps"
          onClick={() => openNavigation('google-maps')}
        >
          <span className="nav-icon">🗺️</span>
          Navigate with Google Maps
        </button>
        
        <button 
          className="nav-button waze"
          onClick={() => openNavigation('waze')}
        >
          <span className="nav-icon">🚗</span>
          Navigate with Waze
        </button>

        <button 
          className="nav-button full-route"
          onClick={openFullRoute}
        >
          <span className="nav-icon">🗂️</span>
          View Full Route
        </button>
      </div>

      <div className="route-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((currentStep) / route.length) * 100}%` }}
          ></div>
        </div>
        <div className="progress-text">
          {currentStep} of {route.length} stops completed
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;