import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, ArrowLeft, LogOut, Save, CheckCircle, AlertTriangle, Eye, EyeOff, Key } from 'lucide-react';
import { API_BASE } from '../config/api';

const SETTINGS_TOKEN_KEY = 'logorythme_settings_token';

interface SettingsData {
  settings: Record<string, string>;
  providers: string[];
}

const PRESET_OPTIONS = ['', 'groq', 'together', 'fireworks', 'perplexity', 'ollama'] as const;

const KEY_FIELDS: Array<{
  key: keyof FormValues;
  labelKey: string;
  descKey: string;
  type?: 'password' | 'text' | 'url' | 'select';
  options?: typeof PRESET_OPTIONS;
}> = [
  { key: 'hfApiKey',             labelKey: 'settings.keys.hfApiKey',             descKey: 'settings.keys.hfApiKeyDesc',             type: 'password' },
  { key: 'hfApiEndpoint',        labelKey: 'settings.keys.hfApiEndpoint',        descKey: 'settings.keys.hfApiEndpointDesc',        type: 'url' },
  { key: 'vercelGatewayKey',     labelKey: 'settings.keys.vercelGatewayKey',     descKey: 'settings.keys.vercelGatewayKeyDesc',     type: 'password' },
  { key: 'googleAiKey',          labelKey: 'settings.keys.googleAiKey',          descKey: 'settings.keys.googleAiKeyDesc',          type: 'password' },
  { key: 'openAiKey',            labelKey: 'settings.keys.openAiKey',            descKey: 'settings.keys.openAiKeyDesc',            type: 'password' },
  { key: 'anthropicKey',         labelKey: 'settings.keys.anthropicKey',         descKey: 'settings.keys.anthropicKeyDesc',         type: 'password' },
  { key: 'customProviderKey',    labelKey: 'settings.keys.customProviderKey',    descKey: 'settings.keys.customProviderKeyDesc',    type: 'password' },
  { key: 'customProviderBaseUrl',labelKey: 'settings.keys.customProviderBaseUrl',descKey: 'settings.keys.customProviderBaseUrlDesc',type: 'url' },
  { key: 'customProviderPreset', labelKey: 'settings.keys.customProviderPreset', descKey: 'settings.keys.customProviderPresetDesc', type: 'select', options: PRESET_OPTIONS },
];

interface FormValues {
  hfApiKey: string;
  hfApiEndpoint: string;
  vercelGatewayKey: string;
  googleAiKey: string;
  openAiKey: string;
  anthropicKey: string;
  customProviderKey: string;
  customProviderBaseUrl: string;
  customProviderPreset: string;
}

const EMPTY_FORM: FormValues = {
  hfApiKey: '',
  hfApiEndpoint: '',
  vercelGatewayKey: '',
  googleAiKey: '',
  openAiKey: '',
  anthropicKey: '',
  customProviderKey: '',
  customProviderBaseUrl: '',
  customProviderPreset: '',
};

function getStoredToken(): string | null {
  try { return sessionStorage.getItem(SETTINGS_TOKEN_KEY); } catch { return null; }
}
function setStoredToken(token: string): void {
  try { sessionStorage.setItem(SETTINGS_TOKEN_KEY, token); } catch { /* ignore */ }
}
function removeStoredToken(): void {
  try { sessionStorage.removeItem(SETTINGS_TOKEN_KEY); } catch { /* ignore */ }
}

/** Single password-type field with show/hide toggle */
function SecretField({ id, value, onChange, placeholder }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 font-mono"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        aria-label={show ? 'Hide value' : 'Show value'}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export default function SettingsPage({ onNavigateBack }: { onNavigateBack?: () => void }) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(getStoredToken);

  // Login state
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Settings state
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [maskedValues, setMaskedValues] = useState<Record<string, string>>({});
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState('');

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token ?? ''}`,
  }), [token]);

  const loadSettings = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${tok}` },
      });
      if (res.status === 401) { setToken(null); removeStoredToken(); return; }
      if (!res.ok) { setLoadError(t('settings.keys.error')); return; }
      const data = await res.json() as SettingsData;
      setMaskedValues(data.settings ?? {});
      setActiveProviders(data.providers ?? []);
    } catch {
      setLoadError(t('settings.keys.error'));
    }
  }, [t]);

  useEffect(() => {
    if (token) {
      void loadSettings(token);
    }
  }, [token, loadSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setLoginError(t('settings.login.error'));
        return;
      }
      const data = await res.json() as { token: string };
      setStoredToken(data.token);
      setToken(data.token);
      setPassword('');
    } catch {
      setLoginError(t('settings.login.error'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (res.status === 401) { setToken(null); removeStoredToken(); return; }
      if (!res.ok) { setSaveStatus('error'); return; }
      const data = await res.json() as { providers: string[] };
      setActiveProviders(data.providers ?? []);
      setSaveStatus('saved');
      setForm(EMPTY_FORM);
      // Reload masked values to reflect new state
      await loadSettings(token ?? '');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/settings/auth`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch { /* ignore */ }
    setToken(null);
    removeStoredToken();
    setForm(EMPTY_FORM);
    setActiveProviders([]);
  };

  const updateField = (key: keyof FormValues) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold">{t('settings.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            {token && (
              <button onClick={handleLogout} className="btn btn-secondary flex items-center gap-2 text-sm">
                <LogOut size={14} />
                {t('settings.logout')}
              </button>
            )}
            <button
              onClick={onNavigateBack ?? (() => window.history.back())}
              className="btn btn-secondary flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={14} />
              {t('settings.back')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!token ? (
          /* Login form */
          <div className="card max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold">{t('settings.login.title')}</h2>
            </div>
            <form onSubmit={e => void handleLogin(e)} className="space-y-4">
              <div>
                <label htmlFor="settings-password" className="block text-sm font-medium mb-1">
                  {t('settings.login.label')}
                </label>
                <input
                  id="settings-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('settings.login.placeholder')}
                  autoComplete="current-password"
                  required
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
              {loginError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {loginError}
                </p>
              )}
              <button type="submit" disabled={loginLoading} className="btn btn-primary w-full">
                {loginLoading ? '...' : t('settings.login.submit')}
              </button>
            </form>
          </div>
        ) : (
          /* Settings form */
          <>
            {/* Active providers banner */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-2">{t('settings.providers.title')}</h2>
              {activeProviders.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {t('settings.providers.none')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeProviders.map(p => (
                    <span
                      key={p}
                      className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {loadError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            )}

            {/* API keys form */}
            <div className="card">
              <h2 className="text-base font-semibold mb-1">{t('settings.keys.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('settings.keys.description')}</p>

              <form onSubmit={e => void handleSave(e)} className="space-y-5">
                {KEY_FIELDS.map(field => (
                  <div key={field.key}>
                    <label htmlFor={`field-${field.key}`} className="block text-sm font-medium mb-0.5">
                      {t(field.labelKey)}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t(field.descKey)}</p>
                    {maskedValues[field.key] && (
                      <p className="text-xs font-mono text-gray-400 mb-1">
                        Current: <span className="text-gray-500">{maskedValues[field.key]}</span>
                      </p>
                    )}
                    {field.type === 'select' ? (
                      <select
                        id={`field-${field.key}`}
                        value={form[field.key]}
                        onChange={e => updateField(field.key)(e.target.value)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        {(field.options ?? PRESET_OPTIONS).map(opt => (
                          <option key={opt} value={opt}>{opt || '(none)'}</option>
                        ))}
                      </select>
                    ) : field.type === 'password' ? (
                      <SecretField
                        id={`field-${field.key}`}
                        value={form[field.key]}
                        onChange={updateField(field.key)}
                        placeholder={t('settings.keys.placeholder')}
                      />
                    ) : (
                      <input
                        id={`field-${field.key}`}
                        type={field.type ?? 'text'}
                        value={form[field.key]}
                        onChange={e => updateField(field.key)(e.target.value)}
                        placeholder={t('settings.keys.placeholder')}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                      />
                    )}
                  </div>
                ))}

                {/* Status + submit */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {saveStatus === 'saved' && (
                      <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle size={14} />
                        {t('settings.keys.saved')}
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle size={14} />
                        {t('settings.keys.error')}
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={saveStatus === 'saving'}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Save size={14} />
                    {saveStatus === 'saving' ? t('settings.keys.saving') : t('settings.keys.save')}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
