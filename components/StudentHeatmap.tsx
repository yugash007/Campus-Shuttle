
import React from 'react';
import { Ride, RideStatus } from '../types';

interface StudentHeatmapProps {
  rides: Ride[];
}

const StudentHeatmap: React.FC<StudentHeatmapProps> = ({ rides }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = [
    '6-8am', '8-10am', '10-12pm', '12-2pm', '2-4pm', '4-6pm', '6-8pm', '8-10pm'
  ];
  const timeSlotMap = {
    '6-8am': [6, 7], '8-10am': [8, 9], '10-12pm': [10, 11], '12-2pm': [12, 13],
    '2-4pm': [14, 15], '4-6pm': [16, 17], '6-8pm': [18, 19], '8-10pm': [20, 21]
  };

  const heatmapData = React.useMemo(() => {
    const grid: { [key: string]: { [key: string]: number } } = {};
    days.forEach(day => {
      grid[day] = {};
      timeSlots.forEach(slot => {
        grid[day][slot] = 0;
      });
    });

    rides
      .filter(ride => ride.status === RideStatus.COMPLETED)
      .forEach(ride => {
        const rideDate = new Date(ride.date);
        const dayOfWeek = days[rideDate.getDay()];
        const hour = rideDate.getHours();

        for (const [slot, hours] of Object.entries(timeSlotMap)) {
          if (hours.includes(hour)) {
            grid[dayOfWeek][slot]++;
            break;
          }
        }
      });
      
    let maxRides = 0;
    Object.values(grid).forEach(dayData => {
        Object.values(dayData).forEach(count => {
            if (count > maxRides) {
                maxRides = count;
            }
        });
    });

    return { grid, maxRides };
  }, [rides]);

  const getColorLevel = (count: number, max: number) => {
    if (count === 0 || max === 0) return 0;
    const percentage = count / max;
    if (percentage > 0.8) return 4;
    if (percentage > 0.5) return 3;
    if (percentage > 0.2) return 2;
    if (percentage > 0) return 1;
    return 0;
  };

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <div className="heatmap-day-label" style={{ flex: '0 0 50px' }}></div> {/* Corner space */}
        {timeSlots.map(slot => (
          <div key={slot} className="heatmap-time-label">{slot}</div>
        ))}
      </div>
      <div className="heatmap-body" role="grid" aria-label="Student ride activity by day and time">
        {days.map(day => (
          <div key={day} className="heatmap-row" role="row">
            <div className="heatmap-day-label" style={{ flex: '0 0 50px' }} role="rowheader">{day}</div>
            {timeSlots.map(slot => {
              const count = heatmapData.grid[day][slot];
              const level = getColorLevel(count, heatmapData.maxRides);
              return (
                <button
                  key={slot}
                  type="button"
                  className="heatmap-cell"
                  data-level={level}
                  aria-label={`${count} rides on ${day}, ${slot}`}
                  title={`${count} rides`}
                  role="gridcell"
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentHeatmap;