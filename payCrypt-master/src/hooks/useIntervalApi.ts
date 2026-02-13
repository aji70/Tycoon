import { useEffect } from "react";
import { apiClient } from "../utils/api";

export function useIntervalApi(endpoint: string, intervalMs = 10000) {
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        await apiClient.get(endpoint);
        if (isMounted) {
          console.log("API call successful:", endpoint);
        }
      } catch (err) {
        console.error("API call failed:", err);
      }
    };

    // Call immediately once
    fetchData();

    // Call repeatedly
    const interval = setInterval(fetchData, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [endpoint, intervalMs]);
}
