import { useEffect, useState } from 'react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data);
    }
    fetchUsers();
  }, []);

  const updateRole = async (id, role) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    // Refresh user list
    fetchUsers();
  };

  return (
    <div>
      <h1>User Management</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <button onClick={() => updateRole(user.id, 'ADMIN')}>Make Admin</button>
                <button onClick={() => updateRole(user.id, 'USER')}>Make User</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}