import React, { useState } from 'react';
import AddressInput from './AddressInput';

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

interface StopManagementProps {
  addresses: Address[];
  onAddressesChange: (addresses: Address[]) => void;
  routeId?: string;
}

const StopManagement: React.FC<StopManagementProps> = ({ 
  addresses, 
  onAddressesChange,
  routeId 
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStop, setNewStop] = useState({
    address: '',
    name: '',
    notes: ''
  });
  const [insertIndex, setInsertIndex] = useState<number | undefined>(undefined);

  const handleAddStop = async () => {
    if (!newStop.address.trim()) {
      alert('Please enter an address');
      return;
    }

    const newAddress: Address = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      address: newStop.address.trim(),
      name: newStop.name.trim() || undefined,
      notes: newStop.notes.trim() || undefined,
      status: 'pending'
    };

    if (routeId) {
      // Update via API if we have a route ID
      try {
        const response = await fetch(`http://localhost:3001/api/routes/${routeId}/stops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: newAddress, insertIndex })
        });

        if (response.ok) {
          const updatedRoute = await response.json();
          onAddressesChange(updatedRoute.addresses);
        } else {
          throw new Error('Failed to add stop');
        }
      } catch (error) {
        console.error('Error adding stop:', error);
        alert('Failed to add stop. Please try again.');
        return;
      }
    } else {
      // Update locally if no route ID
      const updatedAddresses = [...addresses];
      if (insertIndex !== undefined && insertIndex >= 0) {
        updatedAddresses.splice(insertIndex, 0, newAddress);
      } else {
        updatedAddresses.push(newAddress);
      }
      onAddressesChange(updatedAddresses);
    }

    // Reset form
    setNewStop({ address: '', name: '', notes: '' });
    setInsertIndex(undefined);
    setShowAddForm(false);
  };

  const handleRemoveStop = async (addressId: string) => {
    if (!confirm('Are you sure you want to remove this stop?')) {
      return;
    }

    if (routeId) {
      // Update via API
      try {
        const response = await fetch(`http://localhost:3001/api/routes/${routeId}/stops/${addressId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const updatedRoute = await response.json();
          onAddressesChange(updatedRoute.addresses);
        } else {
          throw new Error('Failed to remove stop');
        }
      } catch (error) {
        console.error('Error removing stop:', error);
        alert('Failed to remove stop. Please try again.');
      }
    } else {
      // Update locally
      const updatedAddresses = addresses.filter(addr => addr.id !== addressId);
      onAddressesChange(updatedAddresses);
    }
  };

  const handleMoveStop = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= addresses.length) return;

    const updatedAddresses = [...addresses];
    const [movedStop] = updatedAddresses.splice(fromIndex, 1);
    updatedAddresses.splice(toIndex, 0, movedStop);
    
    onAddressesChange(updatedAddresses);
  };

  return (
    <div className="stop-management">
      <div className="stop-management-header">
        <h4>✏️ Manage Stops</h4>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="add-stop-btn"
        >
          {showAddForm ? '✖️ Cancel' : '➕ Add Stop'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-stop-form">
          <h5>Add New Stop</h5>
          <div className="form-row">
            <AddressInput
              value={newStop.address}
              onChange={(value) => setNewStop({ ...newStop, address: value })}
              onAddressSelect={(suggestion) => {
                setNewStop({
                  ...newStop,
                  address: suggestion.description,
                  // If we got coordinates from the suggestion, we could store them
                });
              }}
              placeholder="Address * (start typing for suggestions)"
              className="form-input"
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Customer/Location Name (optional)"
              value={newStop.name}
              onChange={(e) => setNewStop({ ...newStop, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="form-row">
            <textarea
              placeholder="Notes (optional)"
              value={newStop.notes}
              onChange={(e) => setNewStop({ ...newStop, notes: e.target.value })}
              className="form-textarea"
              rows={2}
            />
          </div>
          <div className="form-row">
            <select
              value={insertIndex ?? ''}
              onChange={(e) => setInsertIndex(e.target.value === '' ? undefined : parseInt(e.target.value))}
              className="form-select"
            >
              <option value="">Add to end</option>
              {addresses.map((_, index) => (
                <option key={index} value={index}>
                  Insert at position {index + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button onClick={handleAddStop} className="add-confirm-btn">
              Add Stop
            </button>
          </div>
        </div>
      )}

      <div className="stops-list">
        {addresses.map((address, index) => (
          <div key={address.id} className={`stop-item ${address.status}`}>
            <div className="stop-position">
              <span className="position-number">{index + 1}</span>
              <div className="position-controls">
                <button
                  onClick={() => handleMoveStop(index, index - 1)}
                  disabled={index === 0}
                  className="move-btn"
                  title="Move up"
                >
                  ⬆️
                </button>
                <button
                  onClick={() => handleMoveStop(index, index + 1)}
                  disabled={index === addresses.length - 1}
                  className="move-btn"
                  title="Move down"
                >
                  ⬇️
                </button>
              </div>
            </div>

            <div className="stop-content">
              <div className="stop-header">
                {address.name && (
                  <div className="stop-name">{address.name}</div>
                )}
                <div className="stop-status">
                  {address.status === 'completed' && '✅ Completed'}
                  {address.status === 'skipped' && '⏭️ Skipped'}
                  {address.status === 'pending' && '⏳ Pending'}
                </div>
              </div>
              <div className="stop-address">{address.address}</div>
              {address.notes && (
                <div className="stop-notes">📝 {address.notes}</div>
              )}
              {address.completedAt && (
                <div className="stop-timestamp">
                  Completed: {new Date(address.completedAt).toLocaleString()}
                </div>
              )}
              {address.skippedAt && (
                <div className="stop-timestamp">
                  Skipped: {new Date(address.skippedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="stop-actions">
              <button
                onClick={() => handleRemoveStop(address.id)}
                className="remove-stop-btn"
                title="Remove stop"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {addresses.length === 0 && (
        <div className="no-stops">
          <p>No stops added yet. Upload a CSV file or add stops manually.</p>
        </div>
      )}
    </div>
  );
};

export default StopManagement;