import React, { useState } from 'react';
import axios from 'axios';

const DataExport = () => {
  const [type, setType] = useState('financial');
  const [format, setFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/admin/analytics/export', {
        type,
        format,
      }, {
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}-data.csv`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        console.log('Exported Data:', response.data);
      }
    } catch (err) {
      setError('Failed to export data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Data Export</h1>
      <form onSubmit={handleExport}>
        <div>
          <label>Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="financial">Financial</option>
            <option value="customer">Customer</option>
          </select>
        </div>
        <div>
          <label>Format:</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Exporting...' : 'Export Data'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default DataExport;