import {
  LucideIcon,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  X as Close,
  CreditCard,
  Github,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  PlusCircle,
  Settings,
  Trash,
  Twitter,
  User,
  UserPlus,
  Users,
  Box
} from 'lucide-react';

export type Icon = LucideIcon;

// SVG icons for third-party services
const quickbooks = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M21.308 6.4h-4.93V4.015c0-.378-.306-.684-.684-.684h-2.89c-.378 0-.684.306-.684.684V6.4H7.623c-.378 0-.684.306-.684.684v2.89c0 .378.306.684.684.684h4.497v2.385c0 .378.306.684.684.684h2.89c.378 0 .684-.306.684-.684V10.66h4.93c.378 0 .684-.306.684-.684V7.085c0-.378-.306-.684-.684-.684z" />
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22.154C6.394 22.154 1.846 17.606 1.846 12S6.394 1.846 12 1.846 22.154 6.394 22.154 12 17.606 22.154 12 22.154z" />
  </svg>
);

const xero = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19.5 0h-15A4.5 4.5 0 000 4.5v15A4.5 4.5 0 004.5 24h15a4.5 4.5 0 004.5-4.5v-15A4.5 4.5 0 0019.5 0zM9.25 17.687L6 12.587l3.25-5.1h2.5l-3.25 5.1 3.25 5.1h-2.5zm5.5 0l-3.25-5.1 3.25-5.1h2.5l-3.25 5.1 3.25 5.1h-2.5z" />
  </svg>
);

const netsuite = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.75C6.615 21.75 2.25 17.385 2.25 12S6.615 2.25 12 2.25 21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
    <path d="M16.5 7.5h-9v9h9v-9zm-6.75 6.75h-1.5v-4.5h1.5v4.5zm3 0h-1.5v-4.5h1.5v4.5zm3 0h-1.5v-4.5h1.5v4.5z" />
  </svg>
);

const salesforce = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M16.678 16.963c-.537.179-1.113.276-1.712.276-2.773 0-5.018-2.245-5.018-5.018 0-2.773 2.245-5.018 5.018-5.018 2.773 0 5.018 2.245 5.018 5.018 0 .599-.097 1.175-.276 1.712.358.179.672.418.933.716.239-.776.366-1.601.366-2.455C21.007 8.3 17.7 5 13.793 5 9.886 5 6.579 8.3 6.579 12.207c0 3.907 3.307 7.214 7.214 7.214.854 0 1.679-.127 2.455-.366-.298-.261-.537-.575-.716-.933z" />
  </svg>
);

const hubspot = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm6.687 16.875h-3v-6h-7.5v6h-3v-10.5h3v1.5h7.5v-1.5h3v10.5z" />
  </svg>
);

export const Icons = {
  add: Plus,
  addCircle: PlusCircle,
  alertCircle: AlertCircle,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronsUpDown: ChevronsUpDown,
  close: Close,
  creditCard: CreditCard,
  dashboard: LayoutDashboard,
  github: Github,
  logo: Box,
  mail: Mail,
  menu: Menu,
  message: MessageSquare,
  quickbooks,
  settings: Settings,
  support: LifeBuoy,
  trash: Trash,
  twitter: Twitter,
  user: User,
  userPlus: UserPlus,
  users: Users,
  xero,
  netsuite,
  salesforce,
  hubspot
} as const;