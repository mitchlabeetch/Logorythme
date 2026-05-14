import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
      title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5 text-gray-600" aria-hidden="true" />
      )}
    </button>
  );
}
