"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
];

interface CurrencySelectorProps {
  currentCurrency: string;
  onCurrencyChange?: (currency: string) => void;
}

export function CurrencySelector({
  currentCurrency,
  onCurrencyChange,
}: CurrencySelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateCurrencyMutation = useMutation({
    mutationFn: async (newCurrency: string) => {
      const response = await fetch("/api/portfolio/currency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: newCurrency }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update currency");
      }

      return response.json();
    },
    onMutate: () => {
      setIsUpdating(true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioCurrency"] });

      if (onCurrencyChange) {
        onCurrencyChange(data.baseCurrency);
      }

      toast({
        title: "Currency Updated",
        description: `Portfolio currency changed to ${data.baseCurrency}`,
      });
      setIsUpdating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsUpdating(false);
    },
  });

  const handleCurrencyChange = (newCurrency: string) => {
    updateCurrencyMutation.mutate(newCurrency);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Display in:</span>
      <Select
        value={currentCurrency}
        onValueChange={handleCurrencyChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </span>
            ) : (
              CURRENCIES.find((c) => c.code === currentCurrency)?.name ||
              currentCurrency
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{currency.symbol}</span>
                <span>{currency.name}</span>
                <span className="text-xs text-gray-500">({currency.code})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
