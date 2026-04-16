import { useState, useCallback } from 'react';
import { useHabitStore } from '../stores/habit-store';
import { saveProofToLog } from '../lib/proof-service';

export function useProofSubmission() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchLogs = useHabitStore((s) => s.fetchLogs);

  const submitProof = useCallback(
    async (
      habitLogId: string,
      proofPhotoUrl?: string,
      proofLocationLat?: number,
      proofLocationLng?: number
    ) => {
      try {
        setIsLoading(true);
        setError(null);

        await saveProofToLog(
          habitLogId,
          proofPhotoUrl,
          proofLocationLat,
          proofLocationLng
        );

        // Reload logs to update the UI
        await fetchLogs();

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit proof';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [fetchLogs]
  );

  return {
    submitProof,
    isLoading,
    error,
  };
}
