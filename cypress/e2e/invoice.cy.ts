describe('Invoice Management', () => {
  beforeEach(() => {
    // Login before each test
    cy.login('test@example.com', 'password123');
  });

  it('should create a new invoice', () => {
    cy.visit('/invoices/new');
    
    // Fill in invoice form
    cy.get('[name="customer"]').select('Test Customer');
    cy.get('[data-testid="add-item-button"]').click();
    
    cy.get('[name="items.0.description"]').type('Test Item');
    cy.get('[name="items.0.quantity"]').type('1');
    cy.get('[name="items.0.unitPrice"]').type('100');
    
    cy.get('[name="dueDate"]').type('2024-12-31');
    cy.get('[name="notes"]').type('Test invoice notes');
    
    // Submit form
    cy.get('button[type="submit"]').click();
    
    // Verify success
    cy.url().should('match', /\/invoices\/[\w-]+$/);
    cy.contains('Invoice created successfully');
  });

  it('should display validation errors', () => {
    cy.visit('/invoices/new');
    
    // Submit empty form
    cy.get('button[type="submit"]').click();
    
    // Verify validation errors
    cy.contains('Customer is required');
    cy.contains('At least one item is required');
    cy.contains('Due date is required');
  });

  it('should list invoices with pagination', () => {
    cy.visit('/invoices');
    
    // Verify list elements
    cy.get('[data-testid="invoice-list-item"]').should('have.length', 10);
    cy.get('[data-testid="pagination"]').should('exist');
    
    // Test pagination
    cy.get('[data-testid="next-page"]').click();
    cy.url().should('include', 'page=2');
  });

  it('should filter invoices', () => {
    cy.visit('/invoices');
    
    // Test status filter
    cy.get('[data-testid="status-filter"]').select('paid');
    cy.url().should('include', 'status=paid');
    cy.get('[data-testid="invoice-list-item"]').each(($el) => {
      cy.wrap($el).should('contain', 'Paid');
    });
  });

  it('should view invoice details', () => {
    // Create test invoice first
    cy.createTestInvoice().then((invoice) => {
      cy.visit(`/invoices/${invoice._id}`);
      
      // Verify invoice details
      cy.contains(invoice.invoiceNumber);
      cy.contains(invoice.customer.name);
      cy.get('[data-testid="total-amount"]').should('contain', invoice.totalAmount);
    });
  });

  it('should update invoice status', () => {
    cy.createTestInvoice().then((invoice) => {
      cy.visit(`/invoices/${invoice._id}`);
      
      // Change status
      cy.get('[data-testid="status-select"]').select('paid');
      cy.get('[data-testid="update-status"]').click();
      
      // Verify status change
      cy.contains('Status updated successfully');
      cy.get('[data-testid="invoice-status"]').should('contain', 'Paid');
    });
  });
});

// Custom commands
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request('POST', '/api/v1/auth/login', {
    email,
    password
  }).then((response) => {
    window.localStorage.setItem('token', response.body.data.accessToken);
  });
});

Cypress.Commands.add('createTestInvoice', () => {
  return cy.request({
    method: 'POST',
    url: '/api/v1/invoices',
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('token')}`
    },
    body: {
      customer: 'test-customer-id',
      items: [{
        description: 'Test Item',
        quantity: 1,
        unitPrice: 100
      }],
      dueDate: '2024-12-31'
    }
  }).then((response) => response.body.data.invoice);
}); 