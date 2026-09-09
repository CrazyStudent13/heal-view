import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getAccessSettings,
  getAuthStatus,
  loginWithPassword,
  logout as logoutRequest,
  saveAccessSettings
} from '../api/fitnessApi.js';
import { normalizeRequestError } from '../utils/requestState.js';

export const useAuthStore = defineStore('auth', () => {
  const enabled = ref(false);
  const configured = ref(false);
  const authenticated = ref(true);
  const loading = ref(false);
  const error = ref('');

  async function fetchStatus() {
    const response = await getAuthStatus();
    enabled.value = Boolean(response.enabled);
    configured.value = Boolean(response.configured);
    authenticated.value = Boolean(response.authenticated);
    return response;
  }

  async function login(password) {
    loading.value = true;
    error.value = '';
    try {
      await loginWithPassword(password);
      authenticated.value = true;
      return true;
    } catch (requestError) {
      error.value = normalizeRequestError(requestError) || '访问密码不正确';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await logoutRequest();
    authenticated.value = false;
  }

  async function fetchSettings() {
    const response = await getAccessSettings();
    enabled.value = Boolean(response.enabled);
    configured.value = Boolean(response.configured);
    return response;
  }

  async function updateSettings(settings) {
    loading.value = true;
    error.value = '';
    try {
      const response = await saveAccessSettings(settings);
      enabled.value = Boolean(response.enabled);
      configured.value = Boolean(response.configured);
      authenticated.value = !enabled.value || authenticated.value;
      return response;
    } catch (requestError) {
      error.value = normalizeRequestError(requestError) || '保存访问保护设置失败';
      throw requestError;
    } finally {
      loading.value = false;
    }
  }

  return {
    enabled,
    configured,
    authenticated,
    loading,
    error,
    fetchStatus,
    login,
    logout,
    fetchSettings,
    updateSettings
  };
});
