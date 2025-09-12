
import React from 'react';

// FIX: Added an interface for component props to accept a className.
interface MapPlaceholderProps {
  className?: string;
}

const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ className = '' }) => {
  return (
    <div 
      className={`map-placeholder ${className}`}
    >
      <div>
        <i className="fas fa-map-marked-alt fa-3x"></i>
        <p className="mt-3 mb-1 fw-bold">
          Live Tracking Unavailable
        </p>
        <p className="small">
          Map could not be loaded.
        </p>
      </div>
    </div>
  );
};

export default MapPlaceholder;