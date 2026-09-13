import { onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useAsyncRequest } from '@/composables/useAsyncRequest.js';

export function useProfileAccess() {
  const { t } = useLocaleStore();
  const auth = useAuthStore();
  const router = useRouter();
  const enabled = ref(false);
  const password = ref('');
  const confirmPassword = ref('');
  const settingsState = useAsyncRequest({ fallbackError: t('auth.settingsLoadFailed') });
  const { loading: settingsLoading, error: settingsError } = settingsState;
  let pageActive = true;

  async function loadSettings() {
    auth.error = '';
    await settingsState.run(async () => {
      const settings = await auth.fetchSettings();
      if (pageActive) enabled.value = settings.enabled;
      return settings;
    }, { fallback: null });
  }

  function syncProtectionPreview(value) {
    auth.enabled = Boolean(value);
    if (!auth.enabled) auth.authenticated = true;
  }

  async function save() {
    auth.error = '';
    if (enabled.value && !auth.configured && !password.value) {
      auth.error = t('auth.passwordRequiredToEnable');
      syncProtectionPreview(false);
      enabled.value = false;
      return;
    }
    if (password.value !== confirmPassword.value) {
      auth.error = t('auth.passwordMismatch');
      return;
    }
    try {
      await auth.updateSettings({ enabled: enabled.value, password: password.value });
      password.value = '';
      confirmPassword.value = '';
      ElMessage.success(t('auth.saved'));
    } catch {
      await loadSettings();
    }
  }

  async function signOut() {
    try {
      await auth.logout();
      ElMessage.success(t('auth.loggedOut'));
      router.push('/login');
    } catch {
      // The store exposes the normalized error for the page-level alert.
    }
  }

  onMounted(loadSettings);
  onUnmounted(() => {
    pageActive = false;
    auth.fetchStatus().catch(() => {});
  });

  return { auth, enabled, password, confirmPassword, settingsLoading, settingsError, loadSettings, syncProtectionPreview, save, signOut };
}
