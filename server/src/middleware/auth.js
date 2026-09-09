import {
  getAccessSettings,
  isRequestAuthenticated
} from '../services/authService.js';

export function requireAccess(req, res, next) {
  if (!getAccessSettings().enabled || isRequestAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).json({
    code: 'AUTH_REQUIRED',
    message: '请先输入访问密码'
  });
}
