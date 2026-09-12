import { computed, ref } from 'vue';
import { isAbortError, normalizeRequestError } from '../utils/requestState.js';

export function useAsyncRequest(options = {}) {
  const fallbackError = options.fallbackError || 'Request failed';
  const loading = ref(false);
  const pendingCount = ref(0);
  const error = ref(null);
  const isIdle = computed(() => pendingCount.value === 0);

  async function run(request, runOptions = {}) {
    const {
      fallback = null,
      rethrow = false,
      normalizeError = normalizeRequestError
    } = runOptions;

    pendingCount.value += 1;
    loading.value = true;
    error.value = null;

    try {
      return await request();
    } catch (requestError) {
      if (!isAbortError(requestError)) {
        error.value = normalizeError(requestError) || fallbackError;
      }
      if (rethrow) throw requestError;
      return fallback;
    } finally {
      pendingCount.value = Math.max(0, pendingCount.value - 1);
      loading.value = pendingCount.value > 0;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    loading,
    pendingCount,
    error,
    isIdle,
    run,
    clearError
  };
}
