"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format"; // ADD THIS
import Link from "next/link";

interface Position {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Avg Cost</TableHead>
            <TableHead className="text-right">Current Price</TableHead>
            <TableHead className="text-right">Market Value</TableHead>
            <TableHead className="text-right">P/L</TableHead>
            <TableHead className="text-right">P/L %</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.id}>
              <TableCell>
                <Link 
                  href={`/portfolio/${position.ticker}`}
                  className="hover:underline"
                >
                  <div>
                    <div className="font-medium">{position.ticker}</div>
                    <div className="text-sm text-gray-600">{position.name}</div>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(position.quantity, position.quantity % 1 === 0 ? 0 : 2)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(position.avgCostBasis)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(position.currentPrice)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(position.marketValue)}
              </TableCell>
              <TableCell className="text-right">
                <div className={cn(
                  "flex items-center justify-end space-x-1",
                  position.unrealizedPL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {position.unrealizedPL >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>
                    {position.unrealizedPL >= 0 && "+"}
                    {formatCurrency(position.unrealizedPL)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className={cn(
                  position.unrealizedPLPercent >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPercent(position.unrealizedPLPercent)}
                </span>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}