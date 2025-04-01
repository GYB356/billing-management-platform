// ...existing code...

export async function generateTaxReport(startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      taxDetails: true,
    },
  });

  const report = transactions.map((transaction) => ({
    date: transaction.date,
    amount: transaction.amount,
    tax: transaction.taxDetails,
  }));

  return report;
}
