export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error";
}

export interface PortfolioResponse {
  id: string;
  userId: string;
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positions: PositionResponse[];
}

export interface PositionResponse {
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