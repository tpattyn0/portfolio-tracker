"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { StockSearch } from "@/components/stock-search";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/format";

const addPositionSchema = z.object({
  ticker: z.string().min(1, "Stock symbol is required"),
  name: z.string().min(1),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
  date: z.string(),
  fees: z.number().min(0).default(0),
});

type AddPositionForm = z.infer<typeof addPositionSchema>;

// Helper to parse number from input (accepts both . and ,)
const parseNumberInput = (value: string): string => {
  // Replace comma with dot for internal processing
  return value.replace(',', '.');
};

export default function AddPositionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [priceInputMode, setPriceInputMode] = useState<'perShare' | 'total'>('perShare');
  
  // Local state for input values (as strings for better control)
  const [quantityInput, setQuantityInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [feesInput, setFeesInput] = useState('0');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddPositionForm>({
    resolver: zodResolver(addPositionSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      fees: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AddPositionForm) => {
      const response = await fetch("/api/portfolio/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add position");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      router.push("/dashboard");
    },
  });

  // Calculate values based on input mode
  const calculateValues = () => {
    const quantity = parseFloat(parseNumberInput(quantityInput)) || 0;
    const fees = parseFloat(parseNumberInput(feesInput)) || 0;

    if (priceInputMode === 'perShare') {
      const price = parseFloat(parseNumberInput(priceInput)) || 0;
      const subtotal = quantity * price;
      return { 
        quantity, 
        price, 
        subtotal,
        fees,
        total: subtotal + fees 
      };
    } else {
      // Total amount mode: the entered amount is EXCLUDING fees
      const totalExcludingFees = parseFloat(parseNumberInput(totalInput)) || 0;
      const price = quantity > 0 ? totalExcludingFees / quantity : 0;
      return { 
        quantity, 
        price, 
        subtotal: totalExcludingFees,
        fees,
        total: totalExcludingFees + fees 
      };
    }
  };

  const values = calculateValues();

  const handleStockSelect = (stock: { symbol: string; name: string; price: number; currency: string }) => {
    setSelectedStock(stock);
    setValue("ticker", stock.symbol);
    setValue("name", stock.name);
    if (priceInputMode === 'perShare') {
      setPriceInput(stock.price.toString());
    }
  };

  const onSubmit = () => {
    const calcValues = calculateValues();
    
    // Validate and submit
    const formData: AddPositionForm = {
      ticker: selectedStock?.symbol || '',
      name: selectedStock?.name || '',
      quantity: calcValues.quantity,
      price: calcValues.price,
      date: watch('date'),
      fees: calcValues.fees
    };

    // Validate manually
    if (!formData.ticker) {
      alert('Please select a stock');
      return;
    }
    if (formData.quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    if (formData.price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Portfolio
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Position</CardTitle>
          <CardDescription>
            Add a stock or ETF to your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
            {mutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {mutation.error?.message || "Failed to add position"}
                </AlertDescription>
              </Alert>
            )}

            {/* Stock Search */}
            <div className="space-y-2">
              <Label>Search Stock/ETF</Label>
              <StockSearch onSelect={handleStockSelect} />
              {selectedStock && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="font-medium">{selectedStock.symbol}</div>
                  <div className="text-sm text-gray-600">{selectedStock.name}</div>
                  <div className="text-sm">
                    Current Price: {formatCurrency(selectedStock.price, selectedStock.currency || 'USD')}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Shares</Label>
              <Input
                id="quantity"
                type="text"
                inputMode="decimal"
                placeholder="10"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
              />
            </div>

            {/* Price Input Mode Toggle */}
            <div className="space-y-2">
              <Label>Price Input Method</Label>
              <Tabs value={priceInputMode} onValueChange={(v) => setPriceInputMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="perShare">Price per Share</TabsTrigger>
                  <TabsTrigger value="total">Total Amount</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Price Input */}
            {priceInputMode === 'perShare' ? (
              <div className="space-y-2">
                <Label htmlFor="price">Price per Share (€)</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  placeholder="150.00"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
                {selectedStock && (
                  <p className="text-xs text-gray-600">
                    Current market price: {formatCurrency(selectedStock.price)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="total">Total Purchase Amount (€)</Label>
                <Input
                  id="total"
                  type="text"
                  inputMode="decimal"
                  placeholder="1500.00"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                />
                <p className="text-xs text-gray-600">
                  Excluding commission & fees
                </p>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Transaction Date</Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            {/* Fees */}
            <div className="space-y-2">
              <Label htmlFor="fees">Commission & Fees (€)</Label>
              <Input
                id="fees"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={feesInput}
                onChange={(e) => setFeesInput(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Shares:</span>
                <span>{values.quantity.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Price per share:</span>
                <span>{formatCurrency(values.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(values.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Commission & Fees:</span>
                <span>{formatCurrency(values.fees)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-medium border-t pt-2">
                <span>Total Cost:</span>
                <span>{formatCurrency(values.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || !selectedStock}
                className="flex-1"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Position...
                  </>
                ) : (
                  "Add Position"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}