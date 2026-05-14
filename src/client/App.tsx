import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Globe, Settings } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useVectorizer } from './hooks/useVectorizer';
import AccessibleUpload from './components/AccessibleUpload';
import ProcessingStatus from './components/ProcessingStatus';
import SvgPreview from './components/SvgPreview';
import ThemeToggle from './components/ThemeToggle';
import ModelSelector from './components/ModelSelector';
import ErrorDisplay from './components/ErrorDisplay';
import QualityBadge from './components/QualityBadge';
import SettingsPage from './components/SettingsPage';
import i18n, { SUPPORTED_LANGUAGES } from './i18n';

export default function App() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { state, progress, result, error, upload, reset } = useVectorizer();
  const [selectedModel, setSelectedModel] = useState('auto');
  const [quality, setQuality] = useState<'high' | 'optimized' | 'minimal'>('optimized');
  const [page, setPage] = useState<'main' | 'settings'>(
    window.location.pathname === '/settings' ? 'settings' : 'main',
  );

  const navigateTo = useCallback((target: 'main' | 'settings') => {
    const path = target === 'settings' ? '/settings' : '/';
    window.history.pushState({}, '', path);
    setPage(target);
  }, []);

  if (page === 'settings') {
    return <SettingsPage onNavigateBack={() => navigateTo('main')} />;
  }

  const handleFileSelect = useCallback((file: File) => {
    const modelParam = selectedModel === 'auto' ? undefined : selectedModel;
    upload(file, quality, modelParam);
  }, [upload, quality, selectedModel]);

  const handleLanguageChange = useCallback((code: string) => {
    i18nInstance.changeLanguage(code);
    document.documentElement.lang = code;
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    if (lang) document.documentElement.dir = lang.dir;
  }, [i18nInstance]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors" dir={i18nInstance.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">{t('nav.skipToContent')}</a>

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{t('app.title')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('app.tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <label htmlFor="lang-select" className="sr-only">{t('nav.language')}</label>
              <select
                id="lang-select"
                value={i18nInstance.language}
                onChange={e => handleLanguageChange(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            <button
              onClick={() => navigateTo('settings')}
              className="btn btn-secondary p-2"
              aria-label={t('settings.nav')}
              title={t('settings.nav')}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        {/* Upload section */}
        {state === 'idle' || state === 'error' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{t('upload.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('app.tagline')}</p>
            </div>

            {/* Quality + Model selectors */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">{t('quality.label')}:</label>
                <select
                  value={quality}
                  onChange={e => setQuality(e.target.value as 'high' | 'optimized' | 'minimal')}
                  className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-600"
                >
                  <option value="high">{t('quality.high')}</option>
                  <option value="optimized">{t('quality.optimized')}</option>
                  <option value="minimal">{t('quality.minimal')}</option>
                </select>
              </div>
              <ModelSelector
                selected={selectedModel}
                onChange={setSelectedModel}
              />
            </div>

            <AccessibleUpload onFileSelect={handleFileSelect} disabled={state === 'uploading'} />

            {state === 'error' && error && (
              <ErrorDisplay error={error} onRetry={reset} onDismiss={reset} />
            )}

            {/* Feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              {[
                { title: t('features.ai.title'), desc: t('features.ai.desc') },
                { title: t('features.crop.title'), desc: t('features.crop.desc') },
                { title: t('features.pipeline.title'), desc: t('features.pipeline.desc') },
              ].map(f => (
                <div key={f.title} className="card text-center">
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Processing or results */}
            {state === 'processing' || state === 'uploading' ? (
              <ProcessingStatus progress={progress} />
            ) : result ? (
              <div className="space-y-4">
                {/* Quality badge */}
                <div className="flex items-center justify-between">
                  <QualityBadge passed={result.quality.passed} warnings={result.quality.warnings} />
                  <button onClick={reset} className="btn btn-secondary text-sm">
                    {t('upload.title')}
                  </button>
                </div>

                {/* Preview */}
                <SvgPreview
                  svg={result.svg}
                  pngBase64={result.png}
                  quality={result.quality}
                />

                {/* Processing details */}
                <details className="card text-sm">
                  <summary className="cursor-pointer font-medium">{t('details.title') || 'Processing Details'}</summary>
                  <dl className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between"><dt>{t('details.model')}:</dt><dd>{result.modelUsed}</dd></div>
                    <div className="flex justify-between"><dt>{t('details.provider')}:</dt><dd>{result.provider}</dd></div>
                    <div className="flex justify-between"><dt>{t('details.time')}:</dt><dd>{result.processingTimeMs}ms</dd></div>
                    <div className="flex justify-between"><dt>{t('details.fillRatio')}:</dt><dd>{Math.round(result.quality.fillRatio * 100)}%</dd></div>
                    <div className="flex justify-between"><dt>{t('details.elements')}:</dt><dd>{result.quality.elementCount}</dd></div>
                  </dl>
                </details>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Logorythme {t('app.version')} — AI-Powered Logo Vectorization
        </div>
      </footer>
    </div>
  );
}
