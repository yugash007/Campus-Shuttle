
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Driver } from '../types';

interface EarningsChartProps {
  data: Driver['weeklyEarnings'];
}

const EarningsChart: React.FC<EarningsChartProps> = ({ data }) => {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#6b7280' }} />
          <YAxis tick={{ fill: '#6b7280' }} tickFormatter={(value) => `₹${value}`} />
          <Tooltip
            cursor={{ fill: 'rgba(20, 184, 166, 0.1)' }}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
            labelStyle={{ color: '#1f2937' }}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Earnings']}
          />
          <Legend />
          <Bar dataKey="earnings" fill="#14b8a6" name="Earnings" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EarningsChart;
