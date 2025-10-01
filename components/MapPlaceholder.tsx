import React from 'react';

// FIX: Added 'isApiKeyMissing' prop to provide specific feedback on API key errors.
interface MapPlaceholderProps {
  className?: string;
  isApiKeyMissing?: boolean;
}

const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ className = '', isApiKeyMissing = false }) => {
  return (
    <div 
      className={`map-placeholder ${className}`}
    >
      {isApiKeyMissing ? (
        <div className="p-3">
          <i className="fas fa-key fa-3x text-warning"></i>
          <p className="mt-3 mb-1 fw-bold">
            Google Maps API Key Missing
          </p>
          <p className="small">
            Please replace <code style={{
              background: 'var(--form-control-bg)', 
              padding: '2px 5px', 
              borderRadius: '4px', 
              border: '1px solid var(--form-control-border-color)'
            }}>YOUR_GOOGLE_MAPS_API_KEY</code> in <strong>index.html</strong> with your key.
          </p>
        </div>
      ) : (
        <div>
          <i className="fas fa-map-marked-alt fa-3x"></i>
          <p className="mt-3 mb-1 fw-bold">
            Live Tracking Unavailable
          </p>
          <p className="small">
            Map could not be loaded.
          </p>
        </div>
      )}
    </div>
  );
};

export default MapPlaceholder;