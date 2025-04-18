import { 
  FETCH_INVOICES_REQUEST,
  FETCH_INVOICES_SUCCESS,
  FETCH_INVOICES_FAILURE,
  FETCH_INVOICE_REQUEST,
  FETCH_INVOICE_SUCCESS,
  FETCH_INVOICE_FAILURE,
  CREATE_INVOICE_REQUEST,
  CREATE_INVOICE_SUCCESS,
  CREATE_INVOICE_FAILURE,
  UPDATE_INVOICE_REQUEST,
  UPDATE_INVOICE_SUCCESS,
  UPDATE_INVOICE_FAILURE,
  DELETE_INVOICE_REQUEST,
  DELETE_INVOICE_SUCCESS,
  DELETE_INVOICE_FAILURE,
  PROCESS_PAYMENT_REQUEST,
  PROCESS_PAYMENT_SUCCESS,
  PROCESS_PAYMENT_FAILURE,
  Invoice,
  InvoiceState
} from '../actions/invoiceActions';

// Define types for the actions
type InvoiceActionType = 
  | { type: typeof FETCH_INVOICES_REQUEST }
  | { type: typeof FETCH_INVOICES_SUCCESS, payload: { invoices: Invoice[], totalCount: number, currentPage: number, totalPages: number } }
  | { type: typeof FETCH_INVOICES_FAILURE, payload: string }
  | { type: typeof FETCH_INVOICE_REQUEST }
  | { type: typeof FETCH_INVOICE_SUCCESS, payload: Invoice }
  | { type: typeof FETCH_INVOICE_FAILURE, payload: string }
  | { type: typeof CREATE_INVOICE_REQUEST }
  | { type: typeof CREATE_INVOICE_SUCCESS, payload: Invoice }
  | { type: typeof CREATE_INVOICE_FAILURE, payload: string }
  | { type: typeof UPDATE_INVOICE_REQUEST }
  | { type: typeof UPDATE_INVOICE_SUCCESS, payload: Invoice }
  | { type: typeof UPDATE_INVOICE_FAILURE, payload: string }
  | { type: typeof DELETE_INVOICE_REQUEST }
  | { type: typeof DELETE_INVOICE_SUCCESS, payload: string }
  | { type: typeof DELETE_INVOICE_FAILURE, payload: string }
  | { type: typeof PROCESS_PAYMENT_REQUEST }
  | { type: typeof PROCESS_PAYMENT_SUCCESS, payload: any }
  | { type: typeof PROCESS_PAYMENT_FAILURE, payload: string };

// Initial state
const initialState: InvoiceState = {
  invoices: [],
  currentInvoice: null,
  loading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  totalPages: 1
};

// Reducer
const invoiceReducer = (
  state: InvoiceState = initialState,
  action: InvoiceActionType
): InvoiceState => {
  switch (action.type) {
    // Fetch all invoices
    case FETCH_INVOICES_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case FETCH_INVOICES_SUCCESS:
      return {
        ...state,
        loading: false,
        invoices: action.payload.invoices,
        totalCount: action.payload.totalCount,
        currentPage: action.payload.currentPage,
        totalPages: action.payload.totalPages,
        error: null
      };
    case FETCH_INVOICES_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    // Fetch single invoice
    case FETCH_INVOICE_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case FETCH_INVOICE_SUCCESS:
      return {
        ...state,
        loading: false,
        currentInvoice: action.payload,
        error: null
      };
    case FETCH_INVOICE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    // Create invoice
    case CREATE_INVOICE_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case CREATE_INVOICE_SUCCESS:
      return {
        ...state,
        loading: false,
        invoices: [action.payload, ...state.invoices],
        currentInvoice: action.payload,
        error: null
      };
    case CREATE_INVOICE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    // Update invoice
    case UPDATE_INVOICE_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case UPDATE_INVOICE_SUCCESS:
      return {
        ...state,
        loading: false,
        invoices: state.invoices.map(invoice => 
          invoice._id === action.payload._id ? action.payload : invoice
        ),
        currentInvoice: action.payload,
        error: null
      };
    case UPDATE_INVOICE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    // Delete invoice
    case DELETE_INVOICE_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case DELETE_INVOICE_SUCCESS:
      return {
        ...state,
        loading: false,
        invoices: state.invoices.filter(invoice => invoice._id !== action.payload),
        currentInvoice: state.currentInvoice?._id === action.payload ? null : state.currentInvoice,
        error: null
      };
    case DELETE_INVOICE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    // Process payment
    case PROCESS_PAYMENT_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case PROCESS_PAYMENT_SUCCESS:
      // Find the invoice that was paid and update its status
      const updatedInvoices = state.invoices.map(invoice => {
        if (invoice._id === action.payload.invoiceId) {
          return {
            ...invoice,
            status: 'paid',
            paymentDate: new Date().toISOString(),
            paymentMethod: action.payload.method
          };
        }
        return invoice;
      });
      
      // Update current invoice if it's the one that was paid
      const updatedCurrentInvoice = state.currentInvoice && 
        state.currentInvoice._id === action.payload.invoiceId
          ? {
              ...state.currentInvoice,
              status: 'paid',
              paymentDate: new Date().toISOString(),
              paymentMethod: action.payload.method
            }
          : state.currentInvoice;
          
      return {
        ...state,
        loading: false,
        invoices: updatedInvoices,
        currentInvoice: updatedCurrentInvoice,
        error: null
      };
    case PROCESS_PAYMENT_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    default:
      return state;
  }
};

export default invoiceReducer; 