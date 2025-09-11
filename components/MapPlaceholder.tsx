import React from 'react';

// FIX: Added an interface for component props to accept a className.
interface MapPlaceholderProps {
  className?: string;
}

const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ className = '' }) => {
  return (
    <div 
      // FIX: Merged the passed className with existing classes to allow for custom styling.
      className={`w-100 rounded-3 d-flex align-items-center justify-content-center text-center ${className}`}
      style={{ 
        minHeight: '200px', 
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      <div>
        <i 
          className="fas fa-map-marked-alt fa-3x" 
          style={{ color: 'var(--accent)', opacity: 0.8 }}
        ></i>
        <p 
          className="mt-3 mb-1 text-white fw-bold"
        >
          Live Tracking Unavailable
        </p>
        <p className="small" style={{color: 'rgba(255,255,255,0.7)'}}>
          Map could not be loaded.
        </p>
      </div>
    </div>
  );
};

export default MapPlaceholder;
