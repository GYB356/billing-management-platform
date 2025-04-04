import React, { useEffect, useState } from 'react';
import axios from 'axios';

const EmailTemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/admin/email-templates');
        setTemplates(response.data);
      } catch (err) {
        setError('Failed to load email templates.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  if (loading) return <p>Loading email templates...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Email Template Management</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Subject</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td>{template.name}</td>
              <td>{template.subject}</td>
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

export default EmailTemplateManagement;