'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      router.push('/admin'); // Redirect to admin dashboard
    } else {
      setError(data.error || 'Invalid email or password');
    }
  };

  return (
    <div className="login-container" style={{ maxWidth: '400px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Sign in to your account</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>Email address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Sign in
        </button>
      </form>
      <div style={{ marginTop: '1rem' }}>
        <p>
          Don't have an account?{' '}
          <a href="/register" style={{ color: '#4F46E5', fontWeight: 'bold', textDecoration: 'none' }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}