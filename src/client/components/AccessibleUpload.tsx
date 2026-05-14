import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileImage, AlertCircle } from 'lucide-react';

interface Props {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

export default function AccessibleUpload({ onFileSelect, disabled, accept = 'image/png,image/jpeg,image/webp' }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(t('errors.invalidFile'));
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('errors.tooLarge'));
      return false;
    }
    setError(null);
    return true;
  }, [t]);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  }, [validateFile, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('upload.dragDrop')}
        aria-disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
          transition-colors duration-200
          ${isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        `}
      >
        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('upload.dragDrop')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('upload.or')} <span className="text-blue-600 font-medium">{t('upload.browse')}</span>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {t('upload.accept')}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        aria-label={t('upload.browse')}
      />

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
