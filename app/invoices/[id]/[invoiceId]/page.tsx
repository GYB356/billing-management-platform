import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

export default function InvoiceDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  // ... existing code ...
} 