import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorDisplay({ error, onRetry, onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
            {t('errors.generic')}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">
            {error}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary flex items-center gap-2 text-sm">
            <RotateCcw size={14} />
            {t('errors.retry')}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="btn btn-secondary text-sm">
            {t('errors.dismiss') || 'Dismiss'}
          </button>
        )}
      </div>
    </div>
  );
}
