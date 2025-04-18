import { ThunkAction } from 'redux-thunk';
import { Action } from 'redux';
import { AxiosError } from 'axios';
import api from '../api';
import { RootState } from '../store';
import { notify } from '../utils/notifications';

// Action Types
export const FETCH_INVOICES_REQUEST = 'FETCH_INVOICES_REQUEST';
export const FETCH_INVOICES_SUCCESS = 'FETCH_INVOICES_SUCCESS'; 
export const FETCH_INVOICES_FAILURE = 'FETCH_INVOICES_FAILURE';

export const FETCH_INVOICE_REQUEST = 'FETCH_INVOICE_REQUEST';
export const FETCH_INVOICE_SUCCESS = 'FETCH_INVOICE_SUCCESS';
export const FETCH_INVOICE_FAILURE = 'FETCH_INVOICE_FAILURE';

export const CREATE_INVOICE_REQUEST = 'CREATE_INVOICE_REQUEST';
export const CREATE_INVOICE_SUCCESS = 'CREATE_INVOICE_SUCCESS';
export const CREATE_INVOICE_FAILURE = 'CREATE_INVOICE_FAILURE';

export const UPDATE_INVOICE_REQUEST = 'UPDATE_INVOICE_REQUEST';
export const UPDATE_INVOICE_SUCCESS = 'UPDATE_INVOICE_SUCCESS';
export const UPDATE_INVOICE_FAILURE = 'UPDATE_INVOICE_FAILURE';

export const DELETE_INVOICE_REQUEST = 'DELETE_INVOICE_REQUEST';
export const DELETE_INVOICE_SUCCESS = 'DELETE_INVOICE_SUCCESS';
export const DELETE_INVOICE_FAILURE = 'DELETE_INVOICE_FAILURE';

export const PROCESS_PAYMENT_REQUEST = 'PROCESS_PAYMENT_REQUEST';
export const PROCESS_PAYMENT_SUCCESS = 'PROCESS_PAYMENT_SUCCESS';
export const PROCESS_PAYMENT_FAILURE = 'PROCESS_PAYMENT_FAILURE';

// Types
export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer: string | {
    _id: string;
    name: string;
    email: string;
  };
  items: Array<{
    _id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
  }>;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  status?: string;
  customer?: string;
  startDate?: string;
  endDate?: string;
}

export interface InvoiceState {
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  success: boolean;
  error: string;
  errorCode?: string;
}

// Helper function to format error messages
const formatErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    // Extract error details from the response if available
    const responseData = error.response?.data as ApiErrorResponse | undefined;
    
    if (responseData?.error) {
      return responseData.error;
    }
    
    if (error.message) {
      return error.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
};

// Action Creators with proper typing
type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Fetch invoices with pagination and filters
export const fetchInvoices = (
  filters: InvoiceFilters = {}
): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: FETCH_INVOICES_REQUEST });
    
    // Build query parameters
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.customer) params.append('customer', filters.customer);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`/invoices?${params.toString()}`);
    
    dispatch({
      type: FETCH_INVOICES_SUCCESS,
      payload: {
        invoices: response.data.data,
        totalCount: response.data.total,
        currentPage: response.data.page,
        totalPages: response.data.pages
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: FETCH_INVOICES_FAILURE, 
      payload: errorMessage
    });
    
    notify('error', `Failed to fetch invoices: ${errorMessage}`);
  }
};

// Fetch a single invoice by ID
export const fetchInvoice = (id: string): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: FETCH_INVOICE_REQUEST });
    
    const response = await api.get(`/invoices/${id}`);
    
    dispatch({
      type: FETCH_INVOICE_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    console.error(`Error fetching invoice ${id}:`, error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: FETCH_INVOICE_FAILURE, 
      payload: errorMessage 
    });
    
    notify('error', `Failed to fetch invoice: ${errorMessage}`);
  }
};

// Create a new invoice
export const createInvoice = (
  invoiceData: Omit<Invoice, '_id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>
): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: CREATE_INVOICE_REQUEST });
    
    const response = await api.post('/invoices', invoiceData);
    
    dispatch({
      type: CREATE_INVOICE_SUCCESS,
      payload: response.data
    });
    
    notify('success', 'Invoice created successfully');
    
    return response.data;
  } catch (error) {
    console.error('Error creating invoice:', error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: CREATE_INVOICE_FAILURE, 
      payload: errorMessage 
    });
    
    notify('error', `Failed to create invoice: ${errorMessage}`);
    
    throw error;
  }
};

// Update an existing invoice
export const updateInvoice = (
  id: string, 
  invoiceData: Partial<Invoice>
): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: UPDATE_INVOICE_REQUEST });
    
    const response = await api.put(`/invoices/${id}`, invoiceData);
    
    dispatch({
      type: UPDATE_INVOICE_SUCCESS,
      payload: response.data
    });
    
    notify('success', 'Invoice updated successfully');
    
    return response.data;
  } catch (error) {
    console.error(`Error updating invoice ${id}:`, error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: UPDATE_INVOICE_FAILURE, 
      payload: errorMessage 
    });
    
    notify('error', `Failed to update invoice: ${errorMessage}`);
    
    throw error;
  }
};

// Delete (cancel) an invoice
export const deleteInvoice = (id: string): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: DELETE_INVOICE_REQUEST });
    
    await api.delete(`/invoices/${id}`);
    
    dispatch({
      type: DELETE_INVOICE_SUCCESS,
      payload: id
    });
    
    notify('success', 'Invoice cancelled successfully');
  } catch (error) {
    console.error(`Error deleting invoice ${id}:`, error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: DELETE_INVOICE_FAILURE, 
      payload: errorMessage 
    });
    
    notify('error', `Failed to cancel invoice: ${errorMessage}`);
  }
};

// Process payment for an invoice
export const processPayment = (
  id: string, 
  paymentData: { amount: number; method: string }
): AppThunk => async (dispatch) => {
  try {
    dispatch({ type: PROCESS_PAYMENT_REQUEST });
    
    const response = await api.post(`/invoices/${id}/payments`, paymentData);
    
    dispatch({
      type: PROCESS_PAYMENT_SUCCESS,
      payload: response.data
    });
    
    notify('success', 'Payment processed successfully');
    
    return response.data;
  } catch (error) {
    console.error(`Error processing payment for invoice ${id}:`, error);
    const errorMessage = formatErrorMessage(error);
    
    dispatch({ 
      type: PROCESS_PAYMENT_FAILURE, 
      payload: errorMessage 
    });
    
    notify('error', `Failed to process payment: ${errorMessage}`);
    
    throw error;
  }
}; 