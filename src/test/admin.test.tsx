import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/app/admin/page';
import { mockUser } from './mocks/data';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Admin Dashboard', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: '1', role: 'admin' } },
      status: 'authenticated',
    });

    // Mock fetch for dashboard stats
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({
        totalUsers: 100,
        activeSubscriptions: 75,
        monthlyRevenue: 7500,
        recentUsers: [mockUser],
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display dashboard statistics', async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/100/i)).toBeInTheDocument();
      expect(screen.getByText(/75/i)).toBeInTheDocument();
      expect(screen.getByText(/\$7,500/i)).toBeInTheDocument();
    });
  });

  it('should handle user management', async () => {
    // Mock fetch for user list
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({
        users: [mockUser],
        total: 1,
      }),
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    });

    const suspendButton = screen.getByRole('button', { name: /suspend/i });
    fireEvent.click(suspendButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/users/suspend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: mockUser.id }),
      });
    });
  });

  it('should handle subscription management', async () => {
    render(<AdminDashboard />);

    const filterSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(filterSelect, { target: { value: 'active' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/subscriptions?status=active');
    });
  });

  it('should handle search functionality', async () => {
    render(<AdminDashboard />);

    const searchInput = screen.getByPlaceholderText(/search users/i);
    fireEvent.change(searchInput, { target: { value: 'test@example.com' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/users?search=test@example.com');
    });
  });

  it('should redirect non-admin users', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: '1', role: 'user' } },
      status: 'authenticated',
    });

    render(<AdminDashboard />);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('should handle error states', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to fetch dashboard data'));

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
    });
  });
}); 