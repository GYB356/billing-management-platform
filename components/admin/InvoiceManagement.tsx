import React, { useEffect, useState } from 'react';
import axios from 'axios';

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await axios.get('/api/admin/invoices');
        setInvoices(response.data);
      } catch (err) {
        setError('Failed to load invoices.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const handleDownload = (pdfBase64, fileName) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = fileName;
    link.click();
  };

  if (loading) return <p>Loading invoices...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Invoice Management</h1>
      <table>
        <thead>
          <tr>
            <th>Subscription ID</th>
            <th>Amount</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.subscriptionId}</td>
              <td>${invoice.amount}</td>
              <td>{invoice.description || 'N/A'}</td>
              <td>
                <button
                  onClick={() => handleDownload(invoice.pdf, `invoice-${invoice.id}.pdf`)}
                >
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceManagement;