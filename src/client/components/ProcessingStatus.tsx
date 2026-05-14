import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

interface Props {
  progress: number;
  currentStage?: string;
}

export default function ProcessingStatus({ progress, currentStage }: Props) {
  const { t } = useTranslation();

  const stages = [
    'upload',
    'analyze',
    'vectorize',
    'optimize',
    'render',
    'complete',
  ];

  const currentIndex = currentStage
    ? stages.indexOf(currentStage)
    : Math.floor((progress / 100) * stages.length);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={progress < 100}
      className="card space-y-4"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" aria-hidden="true" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('processing.status')}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('processing.status')}
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"
      >
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage list */}
      <ol className="space-y-1" aria-label={t('processing.stage', { current: currentIndex + 1, total: stages.length })}>
        {stages.map((stageKey, i) => (
          <li
            key={stageKey}
            className={`
              flex items-center gap-2 text-xs
              ${i < currentIndex ? 'text-green-600 dark:text-green-400' : ''}
              ${i === currentIndex ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}
              ${i > currentIndex ? 'text-gray-400 dark:text-gray-500' : ''}
            `}
            aria-current={i === currentIndex ? 'step' : undefined}
          >
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
              style={{
                borderColor: i <= currentIndex ? 'currentColor' : undefined,
                backgroundColor: i < currentIndex ? 'currentColor' : undefined,
                color: i < currentIndex ? 'white' : undefined,
              }}
            >
              {i < currentIndex ? '\u2713' : i + 1}
            </span>
            {t(`processing.stages.${stageKey}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}
