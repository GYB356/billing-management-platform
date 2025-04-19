import { Customer, Invoice, Plan, Subscription, User } from './models';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

export interface CustomerFilters {
  search?: string;
  status?: 'active' | 'inactive';
  sortBy?: 'createdAt' | 'companyName' | 'email';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InvoiceFilters {
  customerId?: string;
  status?: 'draft' | 'sent' | 'paid' | 'void';
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'dueDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SubscriptionFilters {
  customerId?: string;
  planId?: string;
  status?: 'active' | 'canceled' | 'suspended';
  sortBy?: 'createdAt' | 'currentPeriodEnd';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}