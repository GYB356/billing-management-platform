import { useEffect, useState } from 'react';

export default function PaymentManagement() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function fetchPayments() {
      const response = await fetch('/api/admin/payments');
      const data = await response.json();
      setPayments(data);
    }
    fetchPayments();
  }, []);

  const refundPayment = async (id) => {
    await fetch(`/api/admin/payments/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }), // Example refund amount
    });
    // Refresh payments
    fetchPayments();
  };

  return (
    <div>
      <h1>Payment Management</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.id}</td>
              <td>{payment.userId}</td>
              <td>{payment.amount}</td>
              <td>{payment.status}</td>
              <td>
                <button onClick={() => refundPayment(payment.id)}>Refund</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}