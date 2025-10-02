import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TimelineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>No data available</div>;
  }

  // Format data for display
  const formattedData = data.map(item => ({
    ...item,
    displayMonth: item.month ? item.month.substring(0, 7) : 'Unknown' // Format YYYY-MM
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={formattedData}
        margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="displayMonth"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TimelineChart;
