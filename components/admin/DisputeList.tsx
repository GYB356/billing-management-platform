import { useEffect, useState } from 'react';

export default function DisputeList() {
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    async function fetchDisputes() {
      const response = await fetch('/api/admin/disputes');
      const data = await response.json();
      setDisputes(data);
    }
    fetchDisputes();
  }, []);

  return (
    <div>
      <h1>Payment Disputes</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {disputes.map((dispute) => (
            <tr key={dispute.id}>
              <td>{dispute.id}</td>
              <td>{dispute.amount}</td>
              <td>{dispute.reason}</td>
              <td>{dispute.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}