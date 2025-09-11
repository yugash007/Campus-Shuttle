import React from 'react';

interface EcoAnalyticsProps {
  co2Savings: number;
}

const EcoAnalytics: React.FC<EcoAnalyticsProps> = ({ co2Savings }) => {
  // Average CO2 absorption of a mature tree per year is ~22kg.
  const treesPlantedEquivalent = (co2Savings / 22).toFixed(1);

  return (
    <div 
      className="stats-card d-flex align-items-center justify-content-center p-3"
      style={{
        border: '1px solid var(--accent)',
        background: 'rgba(203, 161, 53, 0.1)',
        minHeight: '100px',
        marginBottom: 0
      }}
    >
      <div className="stats-icon" style={{background: 'none', color: 'var(--accent)', fontSize: '2.5rem', marginBottom: 0}}>
        <i className="fas fa-globe-americas"></i>
      </div>
      <div className="ms-3 text-start">
        <div className="stats-number" style={{fontSize: '1.5rem'}}>
          {co2Savings.toFixed(1)} kg
        </div>
        <div className="stats-label" style={{fontSize: '0.8rem'}}>
          CO2 Saved
        </div>
        <div className="stats-label text-white" style={{fontSize: '0.7rem', opacity: 0.8}}>
          🌱 ~{treesPlantedEquivalent} trees planted
        </div>
      </div>
    </div>
  );
};

export default EcoAnalytics;