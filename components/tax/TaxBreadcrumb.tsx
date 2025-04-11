import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface TaxBreadcrumbProps {
  items: {
    label: string;
    href?: string;
  }[];
}

export function TaxBreadcrumb({ items }: TaxBreadcrumbProps) {
  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={item.label} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
