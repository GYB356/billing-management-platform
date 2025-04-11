import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PricingRulesManagement = () => {
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPricingRules = async () => {
      try {
        const response = await axios.get('/api/admin/pricing-rules');
        setPricingRules(response.data);
      } catch (err) {
        setError('Failed to load pricing rules.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPricingRules();
  }, []);

  if (loading) return <p>Loading pricing rules...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Pricing Rules Management</h1>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Rule Type</th>
            <th>Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pricingRules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.plan.name}</td>
              <td>{rule.type}</td>
              <td>{rule.details}</td>
              <td>
                <button>Edit</button>
                <button>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PricingRulesManagement;