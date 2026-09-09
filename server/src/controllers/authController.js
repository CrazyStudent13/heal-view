import {
  authenticate,
  clearSessionCookie,
  createSession,
  destroySession,
  getAccessSettings,
  getSessionToken,
  isRequestAuthenticated,
  sessionCookie,
  updateAccessSettings
} from '../services/authService.js';

export function getAuthStatus(req, res) {
  const settings = getAccessSettings();
  res.json({
    enabled: settings.enabled,
    configured: settings.configured,
    authenticated: !settings.enabled || isRequestAuthenticated(req)
  });
}

export function login(req, res) {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !authenticate(password)) {
    return res.status(401).json({
      code: 'AUTH_INVALID_PASSWORD',
      message: '访问密码不正确'
    });
  }

  res.setHeader('Set-Cookie', sessionCookie(createSession()));
  return res.json({ authenticated: true });
}

export function logout(req, res) {
  destroySession(getSessionToken(req));
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ authenticated: false });
}

export function getSettings(req, res) {
  res.json(getAccessSettings());
}

export function saveSettings(req, res) {
  try {
    const enabled = Boolean(req.body?.enabled);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password && password.length < 4) {
      return res.status(400).json({
        code: 'AUTH_PASSWORD_TOO_SHORT',
        message: '访问密码至少需要 4 位'
      });
    }
    return res.json(updateAccessSettings({ enabled, password }));
  } catch (error) {
    return res.status(error.status || 500).json({
      code: error.code || 'AUTH_SETTINGS_FAILED',
      message: error.message || '保存访问保护设置失败'
    });
  }
}
