import React, { useEffect, useState } from 'react';
import axios from 'axios';

const CurrencyManagement = () => {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await axios.get('/api/admin/currency/rates');
        setRates(response.data.rates);
      } catch (err) {
        setError('Failed to load currency rates.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  if (loading) return <p>Loading currency rates...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Currency Management</h1>
      <table>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Exchange Rate</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rates).map(([currency, rate]) => (
            <tr key={currency}>
              <td>{currency}</td>
              <td>{rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CurrencyManagement;