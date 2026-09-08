export function isAbortError(error) {
  return error?.name === 'CanceledError'
    || error?.name === 'AbortError'
    || error?.code === 'ERR_CANCELED';
}

export function createLatestRequest() {
  let sequence = 0;
  let controller = null;

  function next() {
    sequence += 1;
    controller?.abort();
    controller = new AbortController();
    const currentId = sequence;
    const currentController = controller;

    return {
      id: currentId,
      signal: currentController.signal,
      isCurrent: () => currentId === sequence && !currentController.signal.aborted
    };
  }

  function isCurrent(id) {
    return id === sequence && !controller?.signal.aborted;
  }

  function cancel() {
    sequence += 1;
    controller?.abort();
    controller = null;
  }

  return {
    next,
    isCurrent,
    cancel
  };
}

export function normalizeRequestError(error) {
  if (isAbortError(error)) return null;
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return 'Request failed';
}
