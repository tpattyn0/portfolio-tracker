"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";

const sellFormSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
  date: z.date(),
  fees: z.number().min(0, "Fees cannot be negative").optional(),
  notes: z.string().optional(),
});

type SellFormData = z.infer<typeof sellFormSchema>;

interface SellPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    id: string;
    ticker: string;
    name: string;
    quantity: number;
    avgCostBasis: number;
    currentPrice: number;
    marketValue: number;
  };
  quote?: {
    price: number;
    change: number;
    changePercent: number;
  };
}

export function SellPositionModal({ 
  isOpen, 
  onClose, 
  position,
  quote 
}: SellPositionModalProps) {
  const [sellPercentage, setSellPercentage] = useState(100);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentPrice = quote?.price || position.currentPrice;
  
  const form = useForm<SellFormData>({
    resolver: zodResolver(sellFormSchema),
    defaultValues: {
      quantity: position.quantity,
      price: currentPrice,
      date: new Date(),
      fees: 0,
      notes: "",
    },
  });

  const sellQuantity = form.watch("quantity");
  const sellPrice = form.watch("price");
  const sellFees = form.watch("fees") || 0;

  // Calculate realized P/L
  const totalSaleValue = sellQuantity * sellPrice;
  const totalCostBasis = sellQuantity * position.avgCostBasis;
  const realizedPL = totalSaleValue - totalCostBasis - sellFees;
  const realizedPLPercent = totalCostBasis > 0 ? (realizedPL / totalCostBasis) * 100 : 0;
  const remainingShares = position.quantity - sellQuantity;
  const isFullSale = remainingShares === 0;

  const sellMutation = useMutation({
    mutationFn: async (data: SellFormData) => {
      const res = await fetch(`/api/portfolio/positions/${position.ticker}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          positionId: position.id,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to sell position");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["position", position.ticker] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      toast({
        title: isFullSale ? "Position Closed" : "Shares Sold",
        description: `Successfully sold ${formatNumber(sellQuantity)} shares of ${position.ticker} for ${realizedPL >= 0 ? "+" : ""}${formatCurrency(realizedPL)}`,
      });
      
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Sale Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handlePercentageChange = (value: number[]) => {
    const raw = Array.isArray(value) && typeof value[0] === "number" ? value[0] : sellPercentage;
    const safePercentage = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    setSellPercentage(safePercentage);
    const baseQty = Number.isFinite(position.quantity) ? position.quantity : 0;
    const quantity = baseQty > 0 ? (baseQty * safePercentage) / 100 : 0;
    form.setValue("quantity", Number(quantity.toFixed(8)));
  };

  const handleQuantityChange = (value: number) => {
    const val = Number.isFinite(value) ? value : 0;
    const denom = Number.isFinite(position.quantity) && position.quantity > 0 ? position.quantity : 0;
    const percentage = denom > 0 ? (val / denom) * 100 : 0;
    setSellPercentage(Math.min(100, Math.max(0, percentage)));
  };

  const onSubmit = (data: SellFormData) => {
    sellMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell {position.ticker}</DialogTitle>
          <DialogDescription>
            {position.name} • {formatNumber(position.quantity)} shares available
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Quick sell percentage selector */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Sell Amount</span>
                <span className="font-medium">{sellPercentage.toFixed(0)}%</span>
              </div>
              
              <Slider
                value={[Number.isFinite(sellPercentage) ? sellPercentage : 0]}
                onValueChange={handlePercentageChange}
                max={100}
                step={1}
                className="w-full"
              />
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageChange([25])}
                >
                  25%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageChange([50])}
                >
                  50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageChange([75])}
                >
                  75%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageChange([100])}
                >
                  All
                </Button>
              </div>
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shares to Sell</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.00000001"
                        {...field}
                        onChange={(e) => {
                          const parsed = e.target.value === "" ? NaN : parseFloat(e.target.value);
                          const safe = Number.isFinite(parsed) ? parsed : 0;
                          field.onChange(safe);
                          handleQuantityChange(safe);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Max: {formatNumber(position.quantity)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Share</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          const parsed = e.target.value === "" ? NaN : parseFloat(e.target.value);
                          field.onChange(Number.isFinite(parsed) ? parsed : 0);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Current: {formatCurrency(currentPrice)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Fees</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => {
                          const parsed = e.target.value === "" ? NaN : parseFloat(e.target.value);
                          field.onChange(Number.isFinite(parsed) ? parsed : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Taking profits, rebalancing..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* P/L Preview — order-summary total row per DESIGN.md */}
            <div className="rounded-md border border-border bg-fill px-4 py-3">
              <div className="space-y-2 text-[13.5px]">
                <div className="flex items-center justify-between text-sub">
                  <span>Sale proceeds</span>
                  <span className="font-medium text-foreground">{formatCurrency(totalSaleValue)}</span>
                </div>

                <div className="flex items-center justify-between text-sub">
                  <span>Cost basis</span>
                  <span className="font-medium text-foreground">-{formatCurrency(totalCostBasis)}</span>
                </div>

                {sellFees > 0 && (
                  <div className="flex items-center justify-between text-sub">
                    <span>Fees</span>
                    <span className="font-medium text-foreground">-{formatCurrency(sellFees)}</span>
                  </div>
                )}

                <div className="pt-3" style={{ borderTop: "3px double var(--foreground)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Realized P/L</span>
                    <div className="text-right">
                      <div className={cn("font-serif text-xl font-medium", realizedPL >= 0 ? "text-up" : "text-dn")}>
                        {realizedPL >= 0 ? "+" : ""}{formatCurrency(realizedPL)}
                      </div>
                      <div className={cn("text-sm", realizedPLPercent >= 0 ? "text-up" : "text-dn")}>
                        {realizedPLPercent >= 0 ? "+" : ""}{formatPercent(realizedPLPercent)}
                      </div>
                    </div>
                  </div>
                </div>

                {!isFullSale && (
                  <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-sub">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-mut" />
                    <span>You&rsquo;ll have {formatNumber(remainingShares)} shares remaining after this sale</span>
                  </div>
                )}

                {isFullSale && (
                  <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-card px-3 py-2 text-sm text-sub">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                    <span>This will close your entire position in {position.ticker}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sellMutation.isPending}
                className={cn(realizedPL >= 0 ? "bg-up hover:bg-up/90" : "bg-dn hover:bg-dn/90", "text-background")}
              >
                {sellMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {realizedPL >= 0 ? (
                      <TrendingUp className="mr-2 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-2 h-4 w-4" />
                    )}
                    Confirm Sale
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}