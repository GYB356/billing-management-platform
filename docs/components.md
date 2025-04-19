 # Component Documentation

## Core Components

### FormField
A reusable form field component that supports various input types and validation.

```tsx
import { FormField } from '@/components/FormField';

// Basic usage
<FormField
  label="Name"
  name="name"
  type="text"
  required
/>

// With validation and help text
<FormField
  label="Email"
  name="email"
  type="email"
  required
  help="Enter your business email"
/>

// Select field
<FormField
  label="Country"
  name="country"
  type="select"
  options={[
    { label: 'USA', value: 'us' },
    { label: 'Canada', value: 'ca' }
  ]}
/>
```

Props:
- `label`: string (required) - Field label
- `name`: string (required) - Field name for form state
- `type`: string - Input type (text, email, password, number, date, textarea, select)
- `placeholder`: string - Input placeholder
- `required`: boolean - Whether the field is required
- `disabled`: boolean - Whether the field is disabled
- `help`: string - Help text shown below the field
- `options`: Array (for select type) - Options for select field

### LoadingSpinner
A customizable loading spinner component.

```tsx
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Basic usage
<LoadingSpinner />

// Custom size and color
<LoadingSpinner size="lg" color="text-blue-600" />
```

Props:
- `size`: 'sm' | 'md' | 'lg' - Spinner size
- `color`: string - Tailwind color class

### ErrorMessage
A component for displaying error messages with different variants.

```tsx
import { ErrorMessage } from '@/components/ErrorMessage';

// Basic error
<ErrorMessage message="Something went wrong" />

// Warning variant
<ErrorMessage
  message="Please review your input"
  variant="warning"
/>

// Info variant
<ErrorMessage
  message="Your session will expire soon"
  variant="info"
/>
```

Props:
- `message`: string (required) - The error message to display
- `variant`: 'error' | 'warning' | 'info' - Message variant

## Form Components

### InvoiceForm
A form component for creating and editing invoices.

```tsx
import { InvoiceForm } from '@/components/InvoiceForm';

// Create mode
<InvoiceForm onSubmit={handleSubmit} />

// Edit mode
<InvoiceForm
  initialData={existingInvoice}
  onSubmit={handleSubmit}
/>
```

Props:
- `initialData`: Partial<InvoiceFormData> - Initial form data for editing
- `onSubmit`: (data: InvoiceFormData) => Promise<void> - Submit handler

### InvoiceItemForm
A sub-form component for managing invoice items.

```tsx
import { InvoiceItemForm } from '@/components/InvoiceItemForm';

<InvoiceItemForm
  items={items}
  onItemsChange={handleItemsChange}
/>
```

Props:
- `items`: InvoiceItem[] - Current items
- `onItemsChange`: (items: InvoiceItem[]) => void - Change handler

## Layout Components

### PageLayout
The main layout component used across pages.

```tsx
import { PageLayout } from '@/components/PageLayout';

<PageLayout title="Invoices">
  <InvoiceList />
</PageLayout>
```

Props:
- `title`: string - Page title
- `children`: ReactNode - Page content

### Sidebar
Navigation sidebar component.

```tsx
import { Sidebar } from '@/components/Sidebar';

<Sidebar
  items={navigationItems}
  currentPath={router.pathname}
/>
```

Props:
- `items`: NavigationItem[] - Navigation items
- `currentPath`: string - Current route path

## Data Display Components

### InvoiceList
Component for displaying a list of invoices with pagination.

```tsx
import { InvoiceList } from '@/components/InvoiceList';

<InvoiceList
  invoices={invoices}
  pagination={pagination}
  onPageChange={handlePageChange}
/>
```

Props:
- `invoices`: Invoice[] - List of invoices
- `pagination`: PaginationData - Pagination information
- `onPageChange`: (page: number) => void - Page change handler

### InvoiceDetails
Component for displaying detailed invoice information.

```tsx
import { InvoiceDetails } from '@/components/InvoiceDetails';

<InvoiceDetails
  invoice={invoice}
  onStatusChange={handleStatusChange}
/>
```

Props:
- `invoice`: Invoice - Invoice data
- `onStatusChange`: (status: InvoiceStatus) => Promise<void> - Status change handler

## Utility Components

### Pagination
Reusable pagination component.

```tsx
import { Pagination } from '@/components/Pagination';

<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={handlePageChange}
/>
```

Props:
- `currentPage`: number - Current page number
- `totalPages`: number - Total number of pages
- `onPageChange`: (page: number) => void - Page change handler

### StatusBadge
Component for displaying status with appropriate colors.

```tsx
import { StatusBadge } from '@/components/StatusBadge';

<StatusBadge status="paid" />
```

Props:
- `status`: InvoiceStatus - Status to display

## Best Practices

1. Component Organization:
   - Keep components focused and single-responsibility
   - Use composition over inheritance
   - Extract reusable logic into custom hooks

2. State Management:
   - Use React Query for server state
   - Use local state for UI state
   - Use context sparingly and only for truly global state

3. Performance:
   - Memoize callbacks with useCallback
   - Memoize expensive computations with useMemo
   - Use virtual scrolling for long lists

4. Accessibility:
   - Use semantic HTML elements
   - Include ARIA labels where needed
   - Ensure keyboard navigation works
   - Test with screen readers

5. Testing:
   - Write unit tests for complex logic
   - Write integration tests for user flows
   - Use React Testing Library best practices

## Example Usage

Complete example of a page using multiple components:

```tsx
import { PageLayout } from '@/components/PageLayout';
import { InvoiceList } from '@/components/InvoiceList';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useInvoices } from '@/hooks/useInvoices';

export const InvoicesPage: React.FC = () => {
  const {
    invoices,
    isLoading,
    error,
    pagination,
    handlePageChange
  } = useInvoices();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <PageLayout title="Invoices">
      <InvoiceList
        invoices={invoices}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </PageLayout>
  );
};
```

## Styling Guidelines

1. Use Tailwind CSS classes consistently
2. Follow the project's color scheme
3. Ensure responsive design works
4. Maintain consistent spacing
5. Use design tokens for colors, spacing, etc.

## Contributing

When creating new components:

1. Follow the established patterns
2. Include TypeScript types
3. Add proper documentation
4. Include unit tests
5. Consider accessibility
6. Consider performance implications