import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <p style={{ margin: 0, fontWeight: 'bold' }}>Project #{data.project_number}</p>
        <p style={{ margin: '5px 0 0 0' }}><strong>Disease:</strong> {data.disease}</p>
        <p style={{ margin: '5px 0 0 0' }}><strong>PI:</strong> {data.pi_name}</p>
        <p style={{ margin: '5px 0 0 0' }}><strong>Specimens:</strong> {data.specimen_count}</p>
      </div>
    );
  }
  return null;
};

const ProjectVolumesChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="project_number"
          label={{ value: 'Project Number', position: 'insideBottom', offset: -15 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis label={{ value: 'Specimen Count', angle: -90, position: 'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="specimen_count" fill="#1976d2" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProjectVolumesChart;
