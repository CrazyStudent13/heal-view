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
  const responseData = error?.response?.data;
  const responseError = normalizeErrorText(responseData?.error);
  const responseMessage = normalizeErrorText(responseData?.message);
  const errorMessage = normalizeErrorText(error?.message);

  if (responseError) return responseError;
  if (responseMessage) return responseMessage;
  if (errorMessage) return errorMessage;
  return 'Request failed';
}

export function normalizeErrorText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.message.trim();

  const nestedMessage = normalizeErrorText(value.message);
  if (nestedMessage) return nestedMessage;

  const nestedTitle = normalizeErrorText(value.title);
  if (nestedTitle) return nestedTitle;

  const nestedDescription = normalizeErrorText(value.description);
  if (nestedDescription) return nestedDescription;

  return '';
}
