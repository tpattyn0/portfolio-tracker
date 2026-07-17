"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Info,
  Calculator,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface ValuationMethod {
  name: string;
  value: number | null;
  formula: string;
  inputs: Record<string, number | null>;
  confidence: 'high' | 'medium' | 'low';
}

interface IntrinsicValueData {
  currentPrice: number;
  intrinsicValue: number | null;
  upside: number | null;
  upsidePercent: number | null;
  methods: ValuationMethod[];
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

interface IntrinsicValueProps {
  symbol: string;
  currentPrice: number;
  currency?: string;
}

export function IntrinsicValue({ symbol, currentPrice, currency }: IntrinsicValueProps) {
  const [data, setData] = useState<IntrinsicValueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchIntrinsicValue();
  }, [symbol, currentPrice]);

  const fetchIntrinsicValue = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(
        `/api/research/${symbol}/intrinsic-value?price=${currentPrice}`
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch intrinsic value");
      }
      
      const data = await res.json();
      setData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-up bg-fill';
      case 'medium':
        return 'text-amber bg-fill';
      case 'low':
        return 'text-dn bg-fill';
      default:
        return 'text-sub bg-fill';
    }
  };

  const getUpsideColor = (percent: number | null) => {
    if (!percent) return '';
    if (percent >= 30) return 'text-up';
    if (percent >= 15) return 'text-up';
    if (percent >= -10) return 'text-foreground';
    if (percent >= -25) return 'text-amber';
    return 'text-dn';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Intrinsic Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-mut" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Intrinsic Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-mut mx-auto mb-2" />
            <p className="text-sub">
              {error || "Unable to calculate intrinsic value"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = data.intrinsicValue 
    ? Math.min((currentPrice / data.intrinsicValue) * 100, 200)
    : 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Intrinsic Value
          </CardTitle>
          <Badge className={getConfidenceColor(data.confidence)}>
            {data.confidence.toUpperCase()} CONFIDENCE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Value Display */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-sub">Current Price</p>
              <p className="text-xl font-semibold">{formatCurrency(currentPrice, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-sub">Intrinsic Value</p>
              <p className="text-xl font-semibold">
                {data.intrinsicValue ? formatCurrency(data.intrinsicValue, currency) : "—"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {data.intrinsicValue && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-sub">
                <span>Undervalued</span>
                <span>Fair Value</span>
                <span>Overvalued</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="text-center">
                <span className={cn("text-sm font-medium", getUpsideColor(data.upsidePercent))}>
                  {progressPercent < 100 ? "▼" : "▲"} {Math.abs(progressPercent - 100).toFixed(0)}% 
                  {progressPercent < 100 ? " below" : " above"} fair value
                </span>
              </div>
            </div>
          )}

          {/* Upside/Downside */}
          {data.upsidePercent !== null && (
            <div className="bg-fill rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-sub">Potential Return</span>
                <div className="flex items-center gap-2">
                  {data.upsidePercent >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-up" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-dn" />
                  )}
                  <span className={cn(
                    "text-lg font-bold",
                    data.upsidePercent >= 0 ? "text-up" : "text-dn"
                  )}>
                    {formatPercent(Math.abs(data.upsidePercent))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Valuation Methods Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-sub">Valuation Methods</h4>
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Intrinsic Value Calculation Details</DialogTitle>
                  <DialogDescription>
                    Multiple valuation methods are used to estimate the fair value of the stock.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {data.methods.map((method, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">{method.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            {method.value && (
                              <span className="font-semibold">
                                {formatCurrency(method.value, currency)}
                              </span>
                            )}
                            <Badge className={getConfidenceColor(method.confidence)}>
                              {method.confidence}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-sub mb-1">Formula:</p>
                            <code className="text-xs bg-fill p-2 rounded block">
                              {method.formula}
                            </code>
                          </div>
                          <div>
                            <p className="text-sm text-sub mb-1">Inputs:</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {Object.entries(method.inputs).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-sub">{key}:</span>
                                  <span className="font-medium">
                                    {value !== null ? 
                                      (typeof value === 'number' ? 
                                        (key.includes('Rate') || key.includes('Ratio') || key.includes('PE') || key.includes('PEG') ? 
                                          (value * (key.includes('Rate') ? 100 : 1)).toFixed(2) + (key.includes('Rate') ? '%' : '') : 
                                          formatCurrency(value, currency)) : 
                                        value) : 
                                      '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Method Summary */}
          <div className="space-y-2">
            {data.methods.slice(0, 3).map((method, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-sub">{method.name}</span>
                <div className="flex items-center gap-2">
                  {method.confidence === 'high' && <CheckCircle className="h-3 w-3 text-up" />}
                  {method.confidence === 'medium' && <AlertCircle className="h-3 w-3 text-amber" />}
                  {method.confidence === 'low' && <XCircle className="h-3 w-3 text-dn" />}
                  <span className={method.value ? "font-medium" : "text-mut"}>
                    {method.value ? formatCurrency(method.value, currency) : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-xs text-mut">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchIntrinsicValue}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}