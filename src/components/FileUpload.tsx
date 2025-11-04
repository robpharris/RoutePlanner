import { useState, useRef } from 'react';

interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
}

interface FileUploadProps {
  onAddressesUploaded: (addresses: Address[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onAddressesUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showCityStatePrompt, setShowCityStatePrompt] = useState(false);
  const [pendingAddresses, setPendingAddresses] = useState<Address[]>([]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase();
    
    if (!allowedExtensions.some(ext => fileExtension.endsWith(ext))) {
      alert('Please upload a CSV or Excel file (.csv, .xls, .xlsx).');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('http://localhost:3003/api/upload-addresses', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.needsCityState) {
        // Show city/state prompt
        setPendingAddresses(data.addresses);
        setShowCityStatePrompt(true);
      } else {
        onAddressesUploaded(data.addresses);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleCityStateSubmit = async () => {
    if (!city.trim() || !state.trim()) {
      alert('Please enter both city and state');
      return;
    }

    try {
      const response = await fetch('http://localhost:3003/api/complete-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: pendingAddresses,
          city: city.trim(),
          state: state.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete addresses');
      }

      const data = await response.json();
      onAddressesUploaded(data.addresses);
      
      // Reset state
      setShowCityStatePrompt(false);
      setPendingAddresses([]);
      setCity('');
      setState('');
      
    } catch (error) {
      console.error('Error completing addresses:', error);
      alert('Failed to complete addresses. Please try again.');
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragIn = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragOut = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="file-upload">
        <div 
          className={`upload-area ${dragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <div className="upload-content">
            {isUploading ? (
              <>
                <div className="spinner"></div>
                <p>Uploading and processing...</p>
              </>
            ) : (
              <>
                <div className="upload-icon">📊</div>
                <h3>Upload CSV or Excel File</h3>
                <p>Drag and drop your file here or click to browse</p>
                <small>
                  Supports: .csv, .xls, .xlsx | Auto-detects delivery formats (Pub, St Num, St Nam, etc.)
                </small>
              </>
            )}
          </div>
        </div>
      </div>

      {showCityStatePrompt && (
        <div className="city-state-modal">
          <div className="modal-content">
            <h3>🏘️ Complete Address Information</h3>
            <p>Your delivery file contains addresses that need city and state information for accurate routing.</p>
            
            <div className="input-group">
              <label htmlFor="city">City:</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Springfield"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="state">State:</label>
              <input
                id="state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g., IL or Illinois"
                maxLength={20}
              />
            </div>

            <p className="address-preview">
              <strong>Preview:</strong> 123 Main St → 123 Main St, {city || 'City'}, {state || 'State'}
            </p>

            <div className="modal-buttons">
              <button 
                onClick={() => setShowCityStatePrompt(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleCityStateSubmit}
                className="btn-primary"
                disabled={!city.trim() || !state.trim()}
              >
                Complete Addresses ({pendingAddresses.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUpload;