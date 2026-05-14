import { useTranslation } from 'react-i18next';
import { Copy, Check, Download } from 'lucide-react';
import { useState, useCallback } from 'react';

interface Props {
  svg: string;
  pngBase64: string;
  filename?: string;
  quality?: { passed: boolean; warnings: string[] };
}

export default function SvgPreview({ svg, pngBase64, filename = 'logo', quality }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = svg;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [svg]);

  const handleDownloadSVG = useCallback(() => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg, filename]);

  const handleDownloadPNG = useCallback(() => {
    const blob = new Blob([Buffer.from(pngBase64, 'base64')], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pngBase64, filename]);

  return (
    <div className="card space-y-4">
      {/* Preview */}
      <figure className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[200px] flex items-center justify-center">
        {/* Checkerboard background for transparency */}
        <div
          className="absolute inset-0 rounded-lg opacity-30"
          style={{
            backgroundImage: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)',
            backgroundSize: '20px 20px',
          }}
        />
        <div
          className="relative w-full max-w-xs"
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={t('preview.title')}
        />
        <figcaption className="sr-only">{t('preview.title')}</figcaption>
      </figure>

      {/* Quality warnings */}
      {quality && quality.warnings.length > 0 && (
        <div role="alert" className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
          {quality.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownloadSVG}
          className="btn btn-secondary flex items-center gap-2 text-sm"
          aria-label={t('preview.downloadSvg')}
        >
          <Download size={14} />
          {t('preview.downloadSvg')}
        </button>
        <button
          onClick={handleDownloadPNG}
          className="btn btn-secondary flex items-center gap-2 text-sm"
          aria-label={t('preview.downloadPng')}
        >
          <Download size={14} />
          {t('preview.downloadPng')}
        </button>
        <button
          onClick={handleCopy}
          className="btn btn-secondary flex items-center gap-2 text-sm"
          aria-label={t('preview.copySvg')}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('preview.copied') || 'Copied!' : t('preview.copySvg')}
        </button>
      </div>
    </div>
  );
}
