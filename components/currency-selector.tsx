"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

/**
 * Meridian dashboard-hero segmented control. Per DESIGN.md, the dashboard hero
 * shows only EUR/USD as a two-segment pill — but the underlying preference
 * covers 8 currencies (CurrencySelector historically rendered all of them via
 * a <Select>). If the user's current currency isn't EUR or USD, it is shown as
 * a third (non-interactive) segment rather than silently rewritten to EUR —
 * see plan Assumptions ("Currency toggle").
 */
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
        title: "Currency updated",
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
    if (newCurrency === currentCurrency || isUpdating) return;
    updateCurrencyMutation.mutate(newCurrency);
  };

  // Show EUR/USD always; if the active currency is something else, surface it
  // as a third segment so the control never silently claims EUR is active.
  const segments = CURRENCIES.filter((c) => c.code === "EUR" || c.code === "USD");
  if (currentCurrency !== "EUR" && currentCurrency !== "USD") {
    const active = CURRENCIES.find((c) => c.code === currentCurrency);
    segments.push(active ?? { code: currentCurrency, name: currentCurrency, symbol: currentCurrency });
  }

  return (
    <div
      title="Display in"
      className="flex h-10 items-center rounded-full border border-border bg-card p-[3px]"
    >
      {segments.map((c) => {
        const isActive = c.code === currentCurrency;
        return (
          <button
            key={c.code}
            type="button"
            disabled={isUpdating}
            onClick={() => handleCurrencyChange(c.code)}
            className={cn(
              "flex h-8 items-center rounded-full px-4 text-xs tracking-[0.06em]",
              isActive
                ? "bg-btnbg font-semibold text-btnfg"
                : "font-medium text-mut hover:text-foreground"
            )}
          >
            {c.code}
          </button>
        );
      })}
    </div>
  );
}
