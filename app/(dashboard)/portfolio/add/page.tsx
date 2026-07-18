"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { StockSearch } from "@/components/stock-search";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

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
  return value.replace(',', '.');
};

export default function AddPositionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [priceInputMode, setPriceInputMode] = useState<'perShare' | 'total'>('perShare');

  const [quantityInput, setQuantityInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [feesInput, setFeesInput] = useState('0');

  const {
    register,
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

  const calculateValues = () => {
    const quantity = parseFloat(parseNumberInput(quantityInput)) || 0;
    const fees = parseFloat(parseNumberInput(feesInput)) || 0;

    if (priceInputMode === 'perShare') {
      const price = parseFloat(parseNumberInput(priceInput)) || 0;
      const subtotal = quantity * price;
      return { quantity, price, subtotal, fees, total: subtotal + fees };
    } else {
      const totalExcludingFees = parseFloat(parseNumberInput(totalInput)) || 0;
      const price = quantity > 0 ? totalExcludingFees / quantity : 0;
      return { quantity, price, subtotal: totalExcludingFees, fees, total: totalExcludingFees + fees };
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

  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = () => {
    setFormError(null);
    const calcValues = calculateValues();

    const formData: AddPositionForm = {
      ticker: selectedStock?.symbol || '',
      name: selectedStock?.name || '',
      quantity: calcValues.quantity,
      price: calcValues.price,
      date: watch('date'),
      fees: calcValues.fees,
    };

    if (!formData.ticker) {
      setFormError('Please select a stock');
      return;
    }
    if (formData.quantity <= 0) {
      setFormError('Please enter a valid quantity');
      return;
    }
    if (formData.price <= 0) {
      setFormError('Please enter a valid price');
      return;
    }

    mutation.mutate(formData);
  };

  const inputClass =
    "w-full h-10 box-border rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none";

  return (
    <div className="mx-auto max-w-[680px]">
      <Link href="/dashboard" className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
        ← Portfolio
      </Link>

      <div className="my-[18px] mb-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-mut">New entry · the ledger</div>
        <h1 className="mt-2.5 font-serif text-[44px] font-medium leading-[1.05]">
          Add a position
        </h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-7 rounded-lg border border-border bg-card p-8"
      >
        {(mutation.isError || formError) && (
          <div className="rounded-md border border-dn/40 bg-fill p-3 text-sm text-dn">
            {formError || mutation.error?.message || "Failed to add position"}
          </div>
        )}

        {/* Stock search */}
        <div>
          <div className="mb-2 text-[10.5px] uppercase tracking-[0.12em] text-mut">
            Search stock or ETF
          </div>
          <StockSearch onSelect={handleStockSelect} />
          {selectedStock && (
            <div className="mt-3 flex items-baseline justify-between rounded-r-md border-l-2 border-foreground bg-fill px-4 py-2.5">
              <span>
                <span className="font-serif text-base font-medium">{selectedStock.name}</span>
                <span className="ml-2 text-[10.5px] uppercase tracking-[0.12em] text-mut">
                  {selectedStock.symbol}
                </span>
              </span>
              <span className="text-sm text-sub">
                {formatCurrency(selectedStock.price, selectedStock.currency || "USD")}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="quantity" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Number of shares
            </label>
            <input
              id="quantity"
              type="text"
              inputMode="decimal"
              placeholder="10"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="date" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
              Transaction date
            </label>
            <input
              id="date"
              type="date"
              max={format(new Date(), "yyyy-MM-dd")}
              className={inputClass}
              {...register("date")}
            />
          </div>
        </div>

        {/* Price / total tab pair */}
        <div>
          <div className="mb-4.5 flex gap-6 border-b border-line2">
            <button
              type="button"
              onClick={() => setPriceInputMode("perShare")}
              className={cn(
                "pb-2 text-[10.5px] uppercase tracking-[0.12em]",
                priceInputMode === "perShare"
                  ? "border-b-2 border-foreground font-semibold text-foreground"
                  : "text-mut"
              )}
            >
              Price per share
            </button>
            <button
              type="button"
              onClick={() => setPriceInputMode("total")}
              className={cn(
                "pb-2 text-[10.5px] uppercase tracking-[0.12em]",
                priceInputMode === "total"
                  ? "border-b-2 border-foreground font-semibold text-foreground"
                  : "text-mut"
              )}
            >
              Total amount
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {priceInputMode === "perShare" ? (
              <div>
                <label htmlFor="price" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                  Price per share (€)
                </label>
                <input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  placeholder="150.00"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className={inputClass}
                />
                {selectedStock && (
                  <p className="mt-1.5 font-serif text-[11px] italic text-mut">
                    Current market price: {formatCurrency(selectedStock.price)}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="total" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                  Total purchase amount (€)
                </label>
                <input
                  id="total"
                  type="text"
                  inputMode="decimal"
                  placeholder="1500.00"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1.5 font-serif text-[11px] italic text-mut">
                  Excluding commission &amp; fees
                </p>
              </div>
            )}

            <div>
              <label htmlFor="fees" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                Commission &amp; fees (€)
              </label>
              <input
                id="fees"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={feesInput}
                onChange={(e) => setFeesInput(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="border-t border-border pt-4 text-[13.5px]">
          <div className="flex justify-between py-1 text-sub">
            <span>Shares</span>
            <span>{values.quantity.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-1 text-sub">
            <span>Price per share</span>
            <span>{formatCurrency(values.price)}</span>
          </div>
          <div className="flex justify-between py-1 text-sub">
            <span>Subtotal</span>
            <span>{formatCurrency(values.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-sub">
            <span>Commission &amp; fees</span>
            <span>{formatCurrency(values.fees)}</span>
          </div>
          <div
            className="mt-3 flex justify-between pt-3.5 font-serif text-[22px]"
            style={{ borderTop: "3px double var(--foreground)" }}
          >
            <span>Total cost</span>
            <span>{formatCurrency(values.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-11 flex-1 rounded-full border border-border bg-transparent text-[13.5px] font-medium text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !selectedStock}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-btnbg text-[13.5px] font-medium text-btnfg disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding position…
              </>
            ) : (
              "Add position"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
