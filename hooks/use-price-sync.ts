import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

export function usePriceSync() {
  const queryClient = useQueryClient();
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portfolio/sync-prices", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync prices");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
  });

  useEffect(() => {
    // Sync prices on mount
    syncMutation.mutate();

    // Sync prices every 5 minutes
    const interval = setInterval(() => {
      syncMutation.mutate();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return syncMutation;
}