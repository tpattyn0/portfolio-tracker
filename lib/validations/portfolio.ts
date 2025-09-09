import { z } from "zod";

export const portfolioSchemas = {
  addPosition: z.object({
    ticker: z.string().min(1).max(10).regex(/^[A-Z0-9.]+$/),
    name: z.string().min(1).max(100),
    quantity: z.number().positive().max(1000000),
    price: z.number().positive().max(1000000),
    date: z.string().datetime(),
    fees: z.number().min(0).max(10000).default(0),
  }),
  
  updatePosition: z.object({
    quantity: z.number().positive().optional(),
    price: z.number().positive().optional(),
  }),
};