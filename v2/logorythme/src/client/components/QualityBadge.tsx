import { Check, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  passed: boolean;
  warnings: string[];
}

export default function QualityBadge({ passed, warnings }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${passed
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        }
      `}
      role="status"
    >
      {passed ? (
        <>
          <Check size={12} aria-hidden="true" />
          <span>{t('quality.passed') || 'Quality Check Passed'}</span>
        </>
      ) : (
        <>
          <AlertTriangle size={12} aria-hidden="true" />
          <span>{warnings.length} {t('quality.warning') || 'Warning'}{warnings.length > 1 ? 's' : ''}</span>
        </>
      )}
    </div>
  );
}
