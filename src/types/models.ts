export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  _id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface Payment {
  _id?: string;
  amount: number;
  method: 'credit_card' | 'bank_transfer' | 'cash' | 'check' | 'other';
  date: Date;
  recordedBy: string;
  notes?: string;
  transactionId?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer: string | Customer;
  items: InvoiceItem[];
  totalAmount: number;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  notes?: string;
  payments: Payment[];
  createdBy: string | User;
  lastModifiedBy?: string | User;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  _id: string;
  token: string;
  user: string | User;
  expiresAt: Date;
  createdAt: Date;
}

export interface ApiResponse<T> {
  status: 'success' | 'fail' | 'error';
  data?: T;
  message?: string;
  error?: {
    statusCode: number;
    status: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<{ items: T[] }> {
  results: number;
  pagination: {
    page: number;
    pages: number;
    total: number;
  };
}

export interface AuthResponse extends ApiResponse<{
  user: User;
  accessToken: string;
  refreshToken: string;
}> {} 