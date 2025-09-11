// FIX: The 'google' namespace was not found. Added ambient type declarations for Google Maps.
declare namespace google {
    namespace maps {
        interface LatLngLiteral {
            lat: number;
            lng: number;
        }
        class Map {
            constructor(mapDiv: HTMLDivElement, opts?: any);
            setCenter(center: LatLngLiteral): void;
            setZoom(zoom: number): void;
            fitBounds(bounds: LatLngBounds): void;
        }
        class LatLngBounds {
            constructor(sw?: LatLngLiteral, ne?: LatLngLiteral);
            extend(point: LatLngLiteral): void;
        }
        namespace marker {
            class AdvancedMarkerElement {
                constructor(opts?: any);
                position?: LatLngLiteral | null;
                map?: Map | null;
            }
        }
    }
}

import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

interface GoogleMapProps {
  driverLocation: google.maps.LatLngLiteral | null;
  userLocation: google.maps.LatLngLiteral | null;
}

const UserMarker = () => (
    <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#4285F4',
        border: '2px solid white',
        boxShadow: '0 0 5px rgba(0,0,0,0.5)',
    }} />
);

const DriverMarker = () => (
     <i 
        className="fas fa-car-side fa-2x" 
        style={{ color: 'var(--accent)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
    ></i>
);

const GoogleMap: React.FC<GoogleMapProps> = ({ driverLocation, userLocation }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  // Effect for initialization
  useEffect(() => {
    if (!mapRef.current || !google || !google.maps || mapInstance.current) {
      return;
    }

    const initialCenter = userLocation || driverLocation;

    if (initialCenter) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: 15,
          mapId: 'CAMPUS_SHUTTLE_MAP_LIVE',
          disableDefaultUI: true,
        });
    }
  }, [userLocation, driverLocation]);

  // Effect for updating markers and bounds
  useEffect(() => {
    if (!mapInstance.current) return;

    // Update or create driver marker
    if (driverLocation) {
        if (!driverMarker.current) {
            const driverMarkerElement = document.createElement('div');
            createRoot(driverMarkerElement).render(<DriverMarker />);
            driverMarker.current = new google.maps.marker.AdvancedMarkerElement({
                map: mapInstance.current,
                content: driverMarkerElement,
                title: 'Driver',
            });
        }
        driverMarker.current.position = driverLocation;
        if (!driverMarker.current.map) {
            driverMarker.current.map = mapInstance.current;
        }
    } else if (driverMarker.current) {
        driverMarker.current.map = null;
    }

    // Update or create user marker
    if (userLocation) {
        if (!userMarker.current) {
            const userMarkerElement = document.createElement('div');
            createRoot(userMarkerElement).render(<UserMarker />);
            userMarker.current = new google.maps.marker.AdvancedMarkerElement({
                map: mapInstance.current,
                content: userMarkerElement,
                title: 'You are here',
            });
        }
        userMarker.current.position = userLocation;
    }

    // Fit bounds
    if (userLocation && driverLocation) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(userLocation);
        bounds.extend(driverLocation);
        mapInstance.current.fitBounds(bounds);
    } else if (userLocation) {
        mapInstance.current.setCenter(userLocation);
        mapInstance.current.setZoom(15);
    } else if (driverLocation) {
        mapInstance.current.setCenter(driverLocation);
        mapInstance.current.setZoom(15);
    }

  }, [driverLocation, userLocation]);

  return <div ref={mapRef} className="w-100 rounded-3" style={{ height: '100%' }} />;
};

export default GoogleMap;