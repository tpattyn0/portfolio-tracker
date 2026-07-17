"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockSearch } from "@/components/stock-search";
import { formatCurrency } from "@/lib/utils/format";

interface AddToWishlistModalProps {
  trigger?: React.ReactNode;
  defaultTicker?: string;
}

export function AddToWishlistModal({ trigger, defaultTicker }: AddToWishlistModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update ticker when defaultTicker changes or modal opens
  useEffect(() => {
    if (defaultTicker) {
      setSelectedStock({ symbol: defaultTicker.toUpperCase() });
    }
  }, [defaultTicker, open]);

  const addMutation = useMutation({
    mutationFn: async (data: {
      ticker: string;
      targetPrice?: number;
      notes?: string;
    }) => {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add to wishlist");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({
        title: "Added to Wishlist",
        description: `${selectedStock?.symbol || ''} has been added to your watchlist`,
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    if (!defaultTicker) {
      setSelectedStock(null);
    }
    setTargetPrice("");
    setNotes("");
  };

  const handleStockSelect = (stock: { symbol: string; name: string; price: number; currency: string }) => {
    setSelectedStock(stock);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStock?.symbol) {
      toast({
        title: "Error",
        description: "Please select a stock",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      ticker: selectedStock.symbol.trim(),
      targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Star className="h-4 w-4 mr-2" />
            Add to watchlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to watchlist</DialogTitle>
          <DialogDescription>
            Add a stock to your watchlist to monitor before investing
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Search Stock/ETF *</Label>
            <StockSearch onSelect={handleStockSelect} />
            {selectedStock && (
              <div className="mt-2 rounded-r-md border-l-2 border-foreground bg-fill p-3">
                <div className="font-medium">{selectedStock.symbol}</div>
                <div className="text-sm text-sub">{selectedStock.name}</div>
                {selectedStock.price && (
                  <div className="text-sm">
                    Current Price: {formatCurrency(selectedStock.price, selectedStock.currency || 'USD')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetPrice">Target Price (Optional)</Label>
            <Input
              id="targetPrice"
              type="number"
              step="0.01"
              placeholder="Enter your buy target price"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              disabled={addMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Set a price alert to know when to buy
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Why are you interested in this stock?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={addMutation.isPending}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending || !selectedStock}>
              {addMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add to Wishlist
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
