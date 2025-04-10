import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/logging/audit";
import { UserStatus } from "@prisma/client";

export async function anonymizeUser(userId: string) {
  // Get user information before anonymization for audit logging
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true }
  });

  // Anonymize user data
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted+${userId}@example.com`,
      name: "Deleted User",
      password: "deleted",
      status: UserStatus.INACTIVE,
      deletedAt: new Date()
    }
  });

  // Log the anonymization action
  await logAudit({
    userId,
    action: "user.anonymized",
    description: `User data anonymized: ${user?.email || userId}`,
    metadata: {
      originalEmail: user?.email,
      originalName: user?.name
    }
  });

  // Optional: clean up related data (invoices, subscriptions, etc.)
  // This is a placeholder for additional cleanup logic
  // You might want to anonymize or delete related records based on your requirements
} 