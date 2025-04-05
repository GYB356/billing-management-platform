import React, { useState } from 'react';
import axios from 'axios';

const TaxCalculation = () => {
  const [amount, setAmount] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCalculateTax = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/admin/tax/calculate', {
        amount: parseFloat(amount),
        country,
        state: state || undefined,
      });

      setResult(response.data);
    } catch (err) {
      setError('Failed to calculate tax.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Tax Calculation</h1>
      <form onSubmit={handleCalculateTax}>
        <div>
          <label>Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Country:</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
        </div>
        <div>
          <label>State (optional):</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Calculating...' : 'Calculate Tax'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <div>
          <h2>Tax Calculation Result</h2>
          <p>Tax Amount: ${result.taxAmount.toFixed(2)}</p>
          <p>Total Amount: ${result.totalAmount.toFixed(2)}</p>
          <p>Tax Rate: {result.taxRate}%</p>
        </div>
      )}
    </div>
  );
};

export default TaxCalculation;