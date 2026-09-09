export function isAbortError(error) {
  return error?.name === 'CanceledError'
    || error?.name === 'AbortError'
    || error?.code === 'ERR_CANCELED';
}

export class ApiRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = options.code || 'REQUEST_FAILED';
    this.status = options.status ?? null;
    this.details = options.details ?? null;
    this.isNetworkError = Boolean(options.isNetworkError);
    this.isTimeout = Boolean(options.isTimeout);
    this.isApiError = true;
    this.cause = options.cause;
  }
}

export function createApiRequestError(error) {
  if (isAbortError(error)) return error;
  if (error?.isApiError) return error;

  const responseData = error?.response?.data;
  const status = error?.response?.status ?? null;
  const responseMessage = normalizeErrorText(responseData?.message);
  const responseError = normalizeErrorText(responseData?.error);
  const responseText = normalizeErrorText(responseData);
  const isTimeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';
  const isNetworkError = !error?.response && !isTimeout;

  let message = responseMessage || responseError || responseText;
  if (!message && isTimeout) message = '请求超时，请稍后重试';
  if (!message && isNetworkError) message = '无法连接服务，请检查服务是否已启动';
  if (!message) message = '请求失败，请稍后重试';

  return new ApiRequestError(message, {
    code: responseData?.code || error?.code || 'REQUEST_FAILED',
    status,
    details: responseData?.details ?? null,
    isNetworkError,
    isTimeout,
    cause: error
  });
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
  if (error?.isApiError) return error.message;
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
