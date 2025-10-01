// FIX: Added ambient Google Maps type declarations to resolve 'Cannot find namespace "google"' errors.
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
        class DirectionsService {
            route(request: DirectionsRequest, callback: (result: DirectionsResult | null, status: DirectionsStatus) => void): void;
        }
        class DirectionsRenderer {
            constructor(opts?: any);
            setMap(map: Map | null): void;
            setDirections(directions: DirectionsResult): void;
        }
        interface DirectionsRequest {
            origin: LatLngLiteral;
            destination: LatLngLiteral;
            travelMode: TravelMode;
        }
        interface DirectionsResult {
            routes: DirectionsRoute[];
        }
        interface DirectionsRoute {
            legs: DirectionsLeg[];
        }
        interface DirectionsLeg {
            duration: { text: string; value: number; };
            distance: { text: string; value: number; };
        }
        enum TravelMode {
            DRIVING = 'DRIVING',
        }
        enum DirectionsStatus {
            OK = 'OK',
        }
    }
}


import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

interface GoogleMapProps {
  driverLocation: google.maps.LatLngLiteral | null;
  userLocation: google.maps.LatLngLiteral | null;
  destinationCoords: google.maps.LatLngLiteral;
  onRouteUpdate: (eta: string | null) => void;
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

const GoogleMap: React.FC<GoogleMapProps> = ({ driverLocation, userLocation, destinationCoords, onRouteUpdate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const directionsService = useRef<google.maps.DirectionsService | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  // Effect for initialization
  useEffect(() => {
    if (!mapRef.current || !google || !google.maps || mapInstance.current) {
      return;
    }

    const initialCenter = userLocation || driverLocation || destinationCoords;

    if (initialCenter) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: 15,
          mapId: 'CAMPUS_SHUTTLE_MAP_LIVE',
          disableDefaultUI: true,
        });

        directionsService.current = new google.maps.DirectionsService();
        directionsRenderer.current = new google.maps.DirectionsRenderer({
            suppressMarkers: true, // We use our own custom markers
            polylineOptions: {
                strokeColor: 'var(--accent)',
                strokeOpacity: 0.8,
                strokeWeight: 6,
            }
        });
        directionsRenderer.current.setMap(mapInstance.current);
    }
  }, [userLocation, driverLocation, destinationCoords]);

  // Effect for updating markers
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
  }, [driverLocation, userLocation]);


  // Effect for calculating and drawing route
  useEffect(() => {
    if (!mapInstance.current || !directionsService.current || !directionsRenderer.current) return;

    if (!driverLocation) {
        directionsRenderer.current.setDirections({ routes: [] }); // Clear route from map
        onRouteUpdate(null);
        // Recenter map on user if driver disappears
        if (userLocation) {
            mapInstance.current.setCenter(userLocation);
            mapInstance.current.setZoom(15);
        }
        return;
    }

    directionsService.current.route({
        origin: driverLocation,
        destination: destinationCoords,
        travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.current?.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            if (leg?.duration?.text) {
                onRouteUpdate(leg.duration.text);
            }
             // Adjust map bounds to fit user, driver, and destination
            const bounds = new google.maps.LatLngBounds();
            if (userLocation) bounds.extend(userLocation);
            bounds.extend(driverLocation);
            bounds.extend(destinationCoords);
            mapInstance.current?.fitBounds(bounds);

        } else {
            console.error(`Directions request failed due to ${status}`);
            onRouteUpdate(null);
            directionsRenderer.current?.setDirections({routes: []}); // Clear route on error
        }
    });

  }, [driverLocation, userLocation, destinationCoords, onRouteUpdate]);

  return <div ref={mapRef} className="w-100 rounded-3" style={{ height: '100%' }} />;
};

export default GoogleMap;
