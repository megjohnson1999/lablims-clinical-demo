import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatusChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>No data available</div>;
  }

  const chartHeight = data.length * 45;

  return (
    <div style={{ width: '100%', height: '320px', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ width: '100%', height: `${chartHeight}px`, minHeight: '320px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis
              dataKey="name"
              type="category"
              width={110}
              interval={0}
              style={{ fontSize: '12px' }}
            />
            <Tooltip />
            <Bar dataKey="value" fill="#ff9800" barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatusChart;
