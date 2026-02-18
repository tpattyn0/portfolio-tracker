"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { format } from "date-fns";

interface TransactionHistoryProps {
  positionId?: string;
  ticker?: string;
  baseCurrency?: string;
}

export function TransactionHistory({ positionId, ticker, baseCurrency = 'EUR' }: TransactionHistoryProps) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", positionId, ticker],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (positionId) params.append("positionId", positionId);
      if (ticker) params.append("ticker", ticker);
      
      const res = await fetch(`/api/portfolio/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  if (isLoading) {
    return <div>Loading transactions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.map((tx: { id: string; type: string; ticker: string; quantity: number; price: number; fees: number; totalAmount: number; executedAt: string }) => (
              <TableRow key={tx.id}>
                <TableCell>
                  {format(new Date(tx.executedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant={tx.type === "BUY" ? "default" : "secondary"}>
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell>{tx.ticker}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(tx.quantity)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(tx.price, baseCurrency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(tx.fees, baseCurrency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(tx.totalAmount, baseCurrency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}