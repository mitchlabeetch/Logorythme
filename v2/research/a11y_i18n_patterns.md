# WCAG 2.1 AA Accessibility & Internationalization Patterns for React Logo Vectorization App

## Research Summary

This document provides comprehensive accessibility (a11y) and internationalization (i18n) patterns for a React-based logo vectorization web application. It covers WCAG 2.1 AA compliance requirements, ARIA implementation patterns, i18n architecture, keyboard navigation mappings, color contrast requirements, and screen reader testing strategies -- all with specific code examples and citations.

---

## Table of Contents

1. [WCAG 2.1 AA Compliance Checklist](#1-wcag-21-aa-compliance-checklist)
2. [ARIA Patterns: File Upload & Drag-and-Drop](#2-aria-patterns-file-upload--drag-and-drop)
3. [Live Region Patterns: Async Processing Status](#3-live-region-patterns-async-processing-status)
4. [Keyboard Navigation: SVG Layer Editor](#4-keyboard-navigation-svg-layer-editor)
5. [ARIA Patterns: SVG Preview & Canvas](#5-aria-patterns-svg-preview--canvas)
6. [i18n Architecture: react-i18next Best Practices](#6-i18n-architecture-react-i18next-best-practices)
7. [Recommended Language Set with Priority](#7-recommended-language-set-with-priority)
8. [Accessible Form Patterns: Error Messaging](#8-accessible-form-patterns-error-messaging)
9. [Dark Mode Accessibility: Contrast & Focus](#9-dark-mode-accessibility-contrast--focus)
10. [Screen Reader Testing Tools & Strategy](#10-screen-reader-testing-tools--strategy)
11. [Keyboard Navigation Mapping](#11-keyboard-navigation-mapping)
12. [Implementation Quick Reference](#13-implementation-quick-reference)

---

## 1. WCAG 2.1 AA Compliance Checklist

WCAG 2.1 Level AA contains **50 testable success criteria** (30 at Level A + 20 at Level AA) organized under the four POUR principles [^134^][^138^]. For a logo vectorization web app, the following criteria are critical:

### 1.1 Perceivable

| Criterion | Requirement | Application to Vectorization App |
|---|---|---|
| **SC 1.1.1** (A) Text Alternatives | All non-text content must have text alternatives | Upload icons need `aria-label`; SVG preview needs `<title>` + `<desc>`; decorative icons need `aria-hidden="true"` |
| **SC 1.3.1** (A) Info & Relationships | Structure must be programmatically determinable | Layer list must use semantic list structure; form labels must be associated with inputs |
| **SC 1.3.2** (A) Meaningful Sequence | Content order must be preserved when sequence matters | Focus order through upload -> processing -> preview -> download must be logical |
| **SC 1.4.1** (A) Use of Color | Color alone cannot convey information | Processing status must use icons + text (not just color); error states need icons |
| **SC 1.4.3** (AA) Contrast (Minimum) | Normal text >= 4.5:1; Large text >= 3:1 | All text in upload, preview, and controls must meet ratios in both themes |
| **SC 1.4.4** (AA) Resize Text | Text resizable to 200% without loss of content | UI must reflow properly at 200% zoom; no horizontal scrolling should be required |
| **SC 1.4.11** (AA) Non-text Contrast | UI components >= 3:1 against adjacent colors | Drop zone borders, focus indicators, layer icons must have 3:1 contrast |
| **SC 1.4.12** (AA) Text Spacing | No content loss when text spacing adjusted | Test with increased line height, paragraph spacing, letter spacing |

### 1.2 Operable

| Criterion | Requirement | Application |
|---|---|---|
| **SC 2.1.1** (A) Keyboard | All functionality operable via keyboard | Upload, layer editing, download all work without a mouse |
| **SC 2.1.2** (A) No Keyboard Trap | Keyboard users must be able to navigate away | SVG editor must not trap focus; modal dialogs must have escape mechanism |
| **SC 2.4.3** (A) Focus Order | Focus order must be logical and intuitive | Tab order: upload -> controls -> preview -> download |
| **SC 2.4.7** (AA) Focus Visible | Visible focus indicator on all keyboard-operable elements | Custom focus indicator 2px+ thick with 3:1 contrast minimum |
| **SC 2.5.5** (AA) Target Size | Targets should be at least 44x44 CSS pixels | Upload buttons, layer items, download buttons must meet minimum |

### 1.3 Understandable

| Criterion | Requirement | Application |
|---|---|---|
| **SC 3.1.1** (A) Language of Page | Default language must be programmatically identifiable | `<html lang="en">` must update with language changes |
| **SC 3.1.2** (AA) Language of Parts | Language changes within content must be marked | If UI shows example text in other languages, wrap in `lang` attribute |
| **SC 3.2.1** (A) On Focus | Focus must not change context unexpectedly | Focusing on upload area must not auto-submit |
| **SC 3.2.4** (AA) Consistent Identification | Components with same function have consistent labels | All upload buttons use same label key; all download actions use same terminology |
| **SC 3.3.1** (A) Error Identification | Errors identified in text | File validation errors described in text, not just red borders |
| **SC 3.3.2** (AA) Labels or Instructions | Visible labels and instructions | File input has visible label; accepted formats clearly stated |
| **SC 3.3.3** (AA) Error Suggestion | Suggest corrections when user makes errors | "File too large. Maximum size is 10MB." or "Only PNG, JPG, SVG accepted." |

### 1.4 Robust

| Criterion | Requirement | Application |
|---|---|---|
| **SC 4.1.2** (A) Name, Role, Value | UI components must expose name, role, value | Custom upload component exposes `role="button"`, accessible name, disabled state |
| **SC 4.1.3** (AA) Status Messages | Status messages must be announced without focus | Processing progress announced via `aria-live="polite"`; completion announced |

---

## 2. ARIA Patterns: File Upload & Drag-and-Drop

### 2.1 Core Requirements

Drag-and-drop **cannot be the sole method** for file upload. WCAG 2.1 AA requires an alternative method such as a "Choose file" button [^140^][^147^].

### 2.2 ARIA Implementation Pattern

```tsx
// Accessible File Upload Component
import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface FileUploadProps {
  onFilesSelected: (files: FileList) => void;
  acceptedFormats?: string[];
  maxSizeMB?: number;
}

export const AccessibleFileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  acceptedFormats = ['.png', '.jpg', '.jpeg', '.svg'],
  maxSizeMB = 10,
}) => {
  const { t } = useTranslation('upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'dragging' | 'error'>('idle');

  // WCAG 2.1: Dragging Movements must have alternative
  const handleKeyUpload = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setUploadStatus('idle');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndUpload(files);
    }
  }, []);

  const validateAndUpload = (files: FileList) => {
    const newErrors: string[] = [];
    Array.from(files).forEach(file => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        newErrors.push(t('errors.fileTooLarge', { name: file.name, maxSize: maxSizeMB }));
      }
    });
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      setUploadStatus('error');
      return;
    }
    
    setErrors([]);
    onFilesSelected(files);
  };

  const dropZoneId = 'drop-zone';
  const errorId = 'upload-errors';
  const descId = 'upload-description';

  return (
    <div>
      {/* Drop Zone - Keyboard accessible alternative provided */}
      <div
        id={dropZoneId}
        role="button"
        tabIndex={0}
        aria-label={t('dropZone.ariaLabel')}
        aria-describedby={`${descId} ${errorId}`}
        aria-invalid={uploadStatus === 'error'}
        className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${uploadStatus === 'error' ? 'error' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); setUploadStatus('dragging'); }}
        onDragLeave={() => { setIsDragOver(false); setUploadStatus('idle'); }}
        onKeyDown={handleKeyUpload}
        onClick={() => inputRef.current?.click()}
        // WCAG 2.5.7: Dragging Movements - clickable alternative
      >
        <span aria-hidden="true" className="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24">
            <title>{t('uploadIcon.title')}</title>
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
          </svg>
        </span>
        <p id={descId}>{t('dropZone.instruction')}</p>
        <span className="formats">{t('dropZone.acceptedFormats', { formats: acceptedFormats.join(', ') })}</span>
      </div>

      {/* Hidden native file input for assistive technology compatibility */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(',')}
        onChange={(e) => e.target.files && validateAndUpload(e.target.files)}
        className="visually-hidden"
        aria-label={t('fileInput.label')}
        aria-describedby={descId}
      />

      {/* Error messages - WCAG 3.3.1, 4.1.3 */}
      {errors.length > 0 && (
        <div id={errorId} role="alert" aria-live="assertive" className="error-container">
          <ul>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

### 2.3 Required ARIA Attributes Summary

| Element | Required ARIA | Purpose |
|---|---|---|
| Drop Zone | `role="button"`, `tabIndex={0}` | Makes div keyboard-focusable and operable |
| Drop Zone | `aria-label` | Describes the upload action |
| Drop Zone | `aria-describedby` | Links to instructions and error messages |
| Drop Zone | `aria-invalid` | Signals validation state to screen readers |
| Error Container | `role="alert"`, `aria-live="assertive"` | Announces errors immediately |
| Native Input | `aria-label` + `aria-describedby` | Accessible name and description for file input |

### 2.4 Drag-and-Drop Accessibility Checklist [^140^][^147^]

- [ ] Drop zone border meets 3:1 contrast against background
- [ ] Drop zone has keyboard alternative (Enter/Space activates file picker)
- [ ] `aria-describedby` links instructions to drop zone
- [ ] Error messages use `aria-describedby` association
- [ ] Visual focus indicator visible on drop zone
- [ ] Icons supplement color-coded status indicators
- [ ] Required fields clearly indicated with `(required)` text
- [ ] Focus order is logical (drop zone -> file list -> submit)

---

## 3. Live Region Patterns: Async Processing Status

### 3.1 Core Pattern

Processing status changes happen asynchronously and must be announced to screen reader users without requiring focus movement. The `aria-live` attribute creates "live regions" that screen readers monitor for content changes [^144^][^146^][^184^].

### 3.2 React Implementation

```tsx
// Accessible Processing Status Component
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type ProcessingStage = 
  | 'uploading' 
  | 'analyzing' 
  | 'vectorizing' 
  | 'optimizing' 
  | 'complete' 
  | 'error';

interface ProcessingStatusProps {
  stage: ProcessingStage;
  progress: number; // 0-100
  fileName: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  stage,
  progress,
  fileName,
}) => {
  const { t } = useTranslation('processing');
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const previousStage = useRef<ProcessingStage>(stage);

  // Stage-to-ARIA live mapping
  const getLiveConfig = (stage: ProcessingStage) => {
    switch (stage) {
      case 'error':
        return { live: 'assertive' as const, atomic: true };
      case 'complete':
        return { live: 'polite' as const, atomic: true };
      default:
        // Use polite for progress to avoid interrupting user
        return { live: 'polite' as const, atomic: false };
    }
  };

  const config = getLiveConfig(stage);

  // Ensure live region is in DOM before announcing (critical for announcements)
  useEffect(() => {
    if (liveRegionRef.current && stage !== previousStage.current) {
      // Stage change announcement
      previousStage.current = stage;
    }
  }, [stage]);

  return (
    <div className="processing-status" role="region" aria-label={t('regionLabel')}>
      {/* Primary live region for status announcements */}
      <div
        ref={liveRegionRef}
        aria-live={config.live}
        aria-atomic={config.atomic}
        aria-relevant="additions text"
        className="visually-hidden"
      >
        {stage === 'error' && t('announcement.error', { fileName })}
        {stage === 'complete' && t('announcement.complete', { fileName })}
      </div>

      {/* Visual progress indicator - must not be the sole means of communication */}
      <div className="progress-container" aria-hidden="false">
        {/* Progress bar with full ARIA semantics */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={t('progress.valueText', { 
            stage: t(`stages.${stage}`), 
            progress 
          })}
          aria-label={t('progress.label', { fileName })}
          className="progress-bar"
        >
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Visible stage label with icon + text (WCAG 1.4.1) */}
        <div className="stage-info">
          <StageIcon stage={stage} />
          <span className="stage-text">
            {t(`stages.${stage}`)}
          </span>
          <span className="stage-percentage" aria-hidden="true">
            {progress}%
          </span>
        </div>
      </div>

      {/* Status log for screen reader users to review history */}
      <ol className="status-log" aria-label={t('statusLog.label')}>
        {(['uploading', 'analyzing', 'vectorizing', 'optimizing'] as const)
          .filter(s => getStageOrder(s) <= getStageOrder(stage))
          .map(s => (
            <li key={s} className={s === stage ? 'current' : 'completed'}>
              {s === stage ? (
                <span aria-current="step">{t(`stages.${s}`)}</span>
              ) : (
                <span>{t(`stages.${s}`)} - {t('completed')}</span>
              )}
            </li>
          ))}
      </ol>
    </div>
  );
};

// Helper: StageIcon component - uses shape + text, not just color
const StageIcon: React.FC<{ stage: ProcessingStage }> = ({ stage }) => {
  switch (stage) {
    case 'complete': return <span className="icon-check" aria-hidden="true">&#10003;</span>;
    case 'error': return <span className="icon-error" aria-hidden="true">&#10007;</span>;
    default: return <span className="icon-spinner" aria-hidden="true">&#9696;</span>;
  }
};

const getStageOrder = (stage: ProcessingStage): number => {
  const order: Record<ProcessingStage, number> = {
    uploading: 1, analyzing: 2, vectorizing: 3, optimizing: 4, complete: 5, error: 0,
  };
  return order[stage];
};
```

### 3.3 Live Region Best Practices [^144^][^146^]

| Pattern | Implementation | Use Case |
|---|---|---|
| **Polite announcements** | `aria-live="polite"` | Progress updates, non-urgent status changes |
| **Assertive announcements** | `aria-live="assertive"` | Errors, completions that require user action |
| **Atomic regions** | `aria-atomic="true"` | When full context needed (e.g., "Upload complete: logo.png") |
| **Non-atomic regions** | `aria-atomic="false"` | When only changed portion should be announced (e.g., percentage) |

### 3.4 Critical Implementation Rules

1. **Live regions must be in DOM before content is injected** -- content injected before the browser parses the live region will not trigger an announcement [^184^].
2. **Use `aria-atomic="true"`** when the update needs context -- "8" is meaningless; "8% complete" is meaningful [^146^].
3. **Reserve `role="alert"`** for critical errors only; overuse creates cognitive overload for screen reader users [^151^].
4. **Always combine visual + programmatic indicators** -- progress bar visually + `aria-valuenow` programmatically.

---

## 4. Keyboard Navigation: SVG Layer Editor

### 4.1 SVG Keyboard Accessibility Foundation

SVG 2 incorporates keyboard navigation based on the HTML `tabindex` model. User agents provide sequential focus navigation to SVG elements that are interactive by default or have `tabindex` attributes [^178^].

### 4.2 Layer Editor Keyboard Pattern

```tsx
// Keyboard-Accessible SVG Layer List
import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface SVGLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  pathCount: number;
  color: string;
}

interface LayerListProps {
  layers: SVGLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onRenameLayer: (id: string, name: string) => void;
  onDeleteLayer: (id: string) => void;
}

export const AccessibleLayerList: React.FC<LayerListProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onReorderLayers,
  onRenameLayer,
  onDeleteLayer,
}) => {
  const { t } = useTranslation('editor');
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Keyboard handler following WAI-ARIA Authoring Practices
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, layer: SVGLayer) => {
    const lastIndex = layers.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(Math.min(index + 1, lastIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(Math.max(index - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(lastIndex);
        break;
      case 'Space':
        e.preventDefault();
        onSelectLayer(layer.id);
        break;
      case 'Enter':
        e.preventDefault();
        onSelectLayer(layer.id);
        break;
      case 'v':
      case 'V':
        // Toggle visibility shortcut
        if (!e.ctrlKey && !e.metaKey) {
          onToggleVisibility(layer.id);
        }
        break;
      case 'l':
      case 'L':
        // Toggle lock shortcut
        if (!e.ctrlKey && !e.metaKey) {
          onToggleLock(layer.id);
        }
        break;
      case 'Delete':
      case 'Backspace':
        onDeleteLayer(layer.id);
        break;
      // Layer reordering: Alt+Arrow
      case 'ArrowDown':
        if (e.altKey) {
          e.preventDefault();
          onReorderLayers(index, Math.min(index + 1, lastIndex));
        }
        break;
      case 'ArrowUp':
        if (e.altKey) {
          e.preventDefault();
          onReorderLayers(index, Math.max(index - 1, 0));
        }
        break;
    }
  }, [layers, onSelectLayer, onToggleVisibility, onToggleLock, onDeleteLayer, onReorderLayers]);

  // Focus management: move focus when focusedIndex changes
  useEffect(() => {
    const listItems = listRef.current?.querySelectorAll('[role="treeitem"]');
    if (listItems && listItems[focusedIndex]) {
      (listItems[focusedIndex] as HTMLElement).focus();
    }
  }, [focusedIndex]);

  return (
    <div className="layer-panel" role="region" aria-label={t('layers.regionLabel')}>
      <h3 id="layer-list-heading">{t('layers.title')}</h3>
      
      {/* Keyboard shortcuts help */}
      <details className="keyboard-help">
        <summary>{t('layers.keyboardHelp')}</summary>
        <dl>
          <dt>&#8593; &#8595;</dt><dd>{t('layers.shortcuts.navigate')}</dd>
          <dt>Space / Enter</dt><dd>{t('layers.shortcuts.select')}</dd>
          <dt>V</dt><dd>{t('layers.shortcuts.visibility')}</dd>
          <dt>L</dt><dd>{t('layers.shortcuts.lock')}</dd>
          <dt>Delete</dt><dd>{t('layers.shortcuts.delete')}</dd>
          <dt>Alt + &#8593; &#8595;</dt><dd>{t('layers.shortcuts.reorder')}</dd>
        </dl>
      </details>

      <ul
        ref={listRef}
        role="tree"
        aria-labelledby="layer-list-heading"
        aria-multiselectable="false"
        className="layer-list"
      >
        {layers.map((layer, index) => {
          const isSelected = layer.id === selectedLayerId;
          
          return (
            <li
              key={layer.id}
              role="treeitem"
              tabIndex={isSelected ? 0 : -1} // Roving tabindex pattern
              aria-selected={isSelected}
              aria-label={t('layers.layerLabel', {
                name: layer.name,
                position: index + 1,
                total: layers.length,
                pathCount: layer.pathCount,
                visible: layer.visible ? t('visible') : t('hidden'),
              })}
              onKeyDown={(e) => handleKeyDown(e, index, layer)}
              onClick={() => onSelectLayer(layer.id)}
              className={`layer-item ${isSelected ? 'selected' : ''}`}
            >
              {/* Reorder handle - keyboard accessible via Alt+Arrow */}
              <button
                className="reorder-handle"
                aria-label={t('layers.reorder', { name: layer.name })}
                tabIndex={-1} // Not in tab order, accessed via list item
              >
                <span aria-hidden="true">&#8942;</span>
              </button>

              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                aria-label={layer.visible 
                  ? t('layers.hide', { name: layer.name })
                  : t('layers.show', { name: layer.name })
                }
                aria-pressed={layer.visible}
                className={`toggle-btn ${layer.visible ? 'visible' : 'hidden'}`}
              >
                {/* Icon uses shape, not just color (WCAG 1.4.1) */}
                <span aria-hidden="true">
                  {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                </span>
              </button>

              {/* Layer info */}
              <span className="layer-name">{layer.name}</span>
              <span className="layer-meta" aria-hidden="true">
                {layer.pathCount} {t('layers.paths')}
              </span>

              {/* Lock toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                aria-label={layer.locked
                  ? t('layers.unlock', { name: layer.name })
                  : t('layers.lock', { name: layer.name })
                }
                aria-pressed={layer.locked}
                className={`toggle-btn ${layer.locked ? 'locked' : ''}`}
              >
                <span aria-hidden="true">
                  {layer.locked ? <LockIcon /> : <UnlockIcon />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Icon components (visual only)
const EyeIcon = () => <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5z"/><line x1="3" y1="3" x2="21" y2="21"/></svg>;
const LockIcon = () => <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const UnlockIcon = () => <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
```

### 4.3 SVG Preview Canvas Keyboard Pattern

```tsx
// Keyboard-Accessible SVG Preview
import React, { useRef, useState } from 'react';

interface SVGPreviewProps {
  svgContent: string;
  altText: string;
  onLayerSelect?: (layerId: string) => void;
}

export const AccessibleSVGPreview: React.FC<SVGPreviewProps> = ({
  svgContent,
  altText,
  onLayerSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      // Zoom controls
      case '+':
      case '=':
        e.preventDefault();
        setZoom(z => Math.min(z + 10, 200));
        break;
      case '-':
        e.preventDefault();
        setZoom(z => Math.max(z - 10, 25));
        break;
      case '0':
        e.preventDefault();
        setZoom(100);
        setPan({ x: 0, y: 0 });
        break;
      // Pan controls
      case 'ArrowUp':
        if (e.ctrlKey) {
          e.preventDefault();
          setPan(p => ({ ...p, y: p.y - 10 }));
        }
        break;
      case 'ArrowDown':
        if (e.ctrlKey) {
          e.preventDefault();
          setPan(p => ({ ...p, y: p.y + 10 }));
        }
        break;
      case 'ArrowLeft':
        if (e.ctrlKey) {
          e.preventDefault();
          setPan(p => ({ ...p, x: p.x - 10 }));
        }
        break;
      case 'ArrowRight':
        if (e.ctrlKey) {
          e.preventDefault();
          setPan(p => ({ ...p, x: p.x + 10 }));
        }
        break;
    }
  };

  return (
    <div
      className="svg-preview-container"
      role="region"
      aria-label={t('preview.regionLabel')}
      onKeyDown={handleKeyDown}
      tabIndex={0} // Container is focusable for keyboard shortcuts
    >
      {/* Screen-reader-only description of the SVG */}
      <div className="visually-hidden" role="img" aria-label={altText}>
        {altText}
      </div>

      {/* Toolbar with accessible controls */}
      <div className="preview-toolbar" role="toolbar" aria-label={t('preview.toolbarLabel')}>
        <button onClick={() => setZoom(z => Math.min(z + 10, 200))} aria-label={t('preview.zoomIn')}>
          <span aria-hidden="true">+</span>
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 10, 25))} aria-label={t('preview.zoomOut')}>
          <span aria-hidden="true">-</span>
        </button>
        <button onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); }} aria-label={t('preview.resetView')}>
          <span aria-hidden="true">&#8634;</span>
        </button>
        <span className="zoom-level" aria-live="polite" aria-atomic="true">
          {t('preview.zoomLevel', { zoom })}
        </span>
      </div>

      {/* SVG rendered area - critical for accessibility */}
      <div
        ref={containerRef}
        className="svg-viewport"
        role="img"
        aria-label={altText}
      >
        <div
          className="svg-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Keyboard shortcuts help */}
      <div className="shortcut-hint">
        {t('preview.shortcuts')}
      </div>
    </div>
  );
};
```

### 4.4 SVG Accessibility Checklist [^136^][^178^]

- [ ] Interactive SVG elements have `tabindex="0"` or are inside `<button>`/`<a>`
- [ ] SVG has `<title>` for short label and `<desc>` for longer description
- [ ] Decorative SVGs use `aria-hidden="true"` and `tabindex="-1"`
- [ ] SVG `<text>` elements meet WCAG contrast requirements
- [ ] SVG container uses `role="img"` with `aria-label` or `aria-labelledby`
- [ ] Complex SVGs have fallback content or ARIA describedby linking to a data table
- [ ] Keyboard handlers wired for Enter/Space on custom SVG controls
- [ ] Focus styles are visible on all interactive SVG elements

---

## 5. ARIA Patterns: SVG Preview & Canvas

### 5.1 Canvas Accessibility Pattern

The `<canvas>` element is not accessible to screen readers because its content is not in the DOM. Two approaches provide text alternatives [^154^]:

```tsx
// Approach 1: ARIA role + aria-label (Recommended for simple cases)
<canvas
  id="vectorPreview"
  width="800"
  height="600"
  role="img"
  aria-label={t('preview.description', {
    layerCount,
    pathCount,
    colors: dominantColors.join(', '),
  })}
/>

// Approach 2: Fallback content + aria-describedby (for complex graphics)
<canvas
  id="vectorPreview"
  width="800"
  height="600"
  role="img"
  aria-labelledby="canvas-title"
  aria-describedby="canvas-desc"
>
  {/* Fallback content for browsers that don't support canvas */}
  <p id="canvas-title">{t('preview.title')}</p>
  <p id="canvas-desc">{t('preview.fullDescription')}</p>
</canvas>

// Approach 3: Complex data alternative (data table for detailed SVG data)
<details className="svg-data-table">
  <summary>{t('preview.accessibleData')}</summary>
  <table>
    <caption>{t('preview.layerData')}</caption>
    <thead>
      <tr>
        <th scope="col">{t('preview.layer')}</th>
        <th scope="col">{t('preview.paths')}</th>
        <th scope="col">{t('preview.fill')}</th>
        <th scope="col">{t('preview.stroke')}</th>
      </tr>
    </thead>
    <tbody>
      {layers.map(layer => (
        <tr key={layer.id}>
          <th scope="row">{layer.name}</th>
          <td>{layer.pathCount}</td>
          <td>{layer.fillColor}</td>
          <td>{layer.strokeColor}</td>
        </tr>
      ))}
    </tbody>
  </table>
</details>
```

### 5.2 Accessible SVG Embedding Pattern

For the SVG preview (rendered SVG content), use the following pattern [^158^]:

```tsx
// Best practice: Inline SVG with full accessibility
interface AccessibleSVGProps {
  svgData: {
    title: string;
    description: string;
    layers: Array<{
      id: string;
      name: string;
      pathCount: number;
      elements: Array<{ type: string; fill?: string }>;
    }>;
  };
}

export const AccessibleSVGPreview: React.FC<AccessibleSVGProps> = ({ svgData }) => {
  const titleId = `svg-title-${svgData.id}`;
  const descId = `svg-desc-${svgData.id}`;

  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      viewBox="0 0 800 600"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Accessibility metadata inside SVG */}
      <title id={titleId}>{svgData.title}</title>
      <desc id={descId}>{svgData.description}</desc>
      
      {/* Layers rendered with accessibility info */}
      {svgData.layers.map(layer => (
        <g
          key={layer.id}
          role="group"
          aria-label={layer.name}
        >
          {/* Layer content */}
        </g>
      ))}
    </svg>
  );
};
```

---

## 6. i18n Architecture: react-i18next Best Practices

### 6.1 Recommended Configuration

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const supportedLngs: Record<string, string> = {
  en: 'English',
  fr: 'Francais',
  es: 'Espanol',
  de: 'Deutsch',
  pt: 'Portugues',
  ja: 'Japanese (日本語)',
  zh: 'Chinese (中文)',
  ar: 'Arabic (العربية)',
  ko: 'Korean (한국어)',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Turkce',
  vi: 'Vietnamese (Tieng Viet)',
  id: 'Indonesian (Bahasa Indonesia)',
};

i18n
  .use(HttpApi)          // Load translations via HTTP
  .use(LanguageDetector) // Auto-detect browser language
  .use(initReactI18next) // React integration
  .init({
    // Language settings
    fallbackLng: 'en',
    supportedLngs: Object.keys(supportedLngs),
    
    // Namespace configuration for modular loading
    ns: ['common', 'upload', 'processing', 'editor', 'download', 'errors'],
    defaultNS: 'common',
    
    // Backend configuration
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    // Detection order: URL param -> cookie -> localStorage -> browser
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false, // React handles XSS protection
    },
    
    // React-specific
    react: {
      useSuspense: true,
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'em', 'a'],
    },
    
    // Missing key handling (development)
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation: ${ns}:${key} for language ${lng}`);
    },
    
    // Return key name as fallback if translation missing
    parseMissingKeyHandler: (key) => `[${key}]`,
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;
```

### 6.2 Translation File Structure

```
public/
  locales/
    en/
      common.json       # Shared UI elements (buttons, labels, navigation)
      upload.json       # File upload feature
      processing.json   # Processing stages and progress
      editor.json       # SVG layer editor
      download.json     # Download/export feature
      errors.json       # Error messages and validation
    fr/
      common.json
      upload.json
      processing.json
      editor.json
      download.json
      errors.json
    es/
      ...
```

### 6.3 Translation File Example (English)

```json
// public/locales/en/upload.json
{
  "title": "Upload Your Logo",
  "subtitle": "Convert raster images (PNG, JPG) to scalable vector SVG",
  "dropZone": {
    "ariaLabel": "File upload drop zone. Press Enter or Space to open file picker",
    "instruction": "Drag & drop your image here, or click to browse",
    "acceptedFormats": "Supported formats: {{formats}}",
    "active": "Drop your file here"
  },
  "fileInput": {
    "label": "Choose file to upload"
  },
  "uploadIcon": {
    "title": "Upload icon"
  },
  "errors": {
    "fileTooLarge": "File \"{{name}}\" is too large. Maximum size is {{maxSize}} MB.",
    "invalidFormat": "File \"{{name}}\" has an unsupported format. Please use: {{formats}}.",
    "noFileSelected": "Please select a file to upload.",
    "networkError": "Network error. Please check your connection and try again.",
    "serverError": "Server error ({{code}}). Please try again later."
  },
  "fileInfo": {
    "name": "File name",
    "size": "Size",
    "type": "Type",
    "dimensions": "Dimensions"
  }
}
```

### 6.4 Component Usage Pattern

```tsx
// Using useTranslation hook (recommended)
import { useTranslation } from 'react-i18next';

export const UploadButton = () => {
  const { t, i18n } = useTranslation('upload'); // Specify namespace
  
  return (
    <button aria-label={t('dropZone.ariaLabel')}>
      {t('dropZone.instruction')}
    </button>
  );
};

// Using Trans component for rich text
import { Trans } from 'react-i18next';

export const UploadHelp = () => (
  <p>
    <Trans i18nKey="upload:helpText" values={{ formats: 'PNG, JPG, SVG' }}>
      We support <strong>{{ formats }}</strong> file formats
    </Trans>
  </p>
);

// Pluralization
const { t } = useTranslation('upload');
t('fileCount', { count: files.length }); // Uses "one", "other" plural forms

// Interpolation with HTML
const { t } = useTranslation('upload');
t('dropZone.acceptedFormats', { formats: acceptedFormats.join(', ') });
```

### 6.5 RTL Language Support

```tsx
// src/hooks/useDocumentDirection.ts
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const useDocumentDirection = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.resolvedLanguage) {
      // Set lang attribute for screen readers
      document.documentElement.lang = i18n.resolvedLanguage;
      // Set dir attribute for RTL support
      document.documentElement.dir = i18n.dir(i18n.resolvedLanguage);
    }
  }, [i18n, i18n.resolvedLanguage]);
};
```

### 6.6 Key i18n Best Practices [^153^][^156^][^160^]

1. **Use ICU Message Format** for complex pluralization (i18next supports via plugins)
2. **Never hardcode pluralization rules** -- use i18n library support [^160^]
3. **Use namespaces** to split translations by feature (upload, editor, download)
4. **Set `escapeValue: false`** when using React (React handles XSS protection) [^186^]
5. **Use `returnEmptyString: false`** to show key names for missing translations during development
6. **Cache language preference** in localStorage for returning users
7. **Implement fallback chain**: `fr-CA` -> `fr` -> `en` [^191^]

---

## 7. Recommended Language Set with Priority

### 7.1 Tier 1: Core Languages (Immediate)

| Priority | Language | Code | Rationale |
|---|---|---|---|
| 1 | English | `en` | Base language; all fallbacks lead here |
| 2 | French | `fr` | EU market; Canada; already partially implemented |
| 3 | Spanish | `es` | 500M+ speakers; Latin America; US market |
| 4 | German | `de` | EU market; high SaaS adoption |
| 5 | Portuguese | `pt` | Brazil; Portugal; 250M+ speakers |

### 7.2 Tier 2: Expansion Languages (Phase 2)

| Priority | Language | Code | Rationale |
|---|---|---|---|
| 6 | Japanese | `ja` | Major tech market; high GDP |
| 7 | Simplified Chinese | `zh` | Largest internet user base |
| 8 | Korean | `ko` | Tech-savvy market; high design tool usage |
| 9 | Italian | `it` | EU market; design industry |
| 10 | Dutch | `nl` | Belgium; Netherlands; high English fluency but appreciated |

### 7.3 Tier 3: Growth Languages (Phase 3)

| Priority | Language | Code | Rationale |
|---|---|---|---|
| 11 | Polish | `pl` | Large EU market; growing tech sector |
| 12 | Turkish | `tr` | Growing market; young population |
| 13 | Arabic | `ar` | RTL language; 400M+ speakers across MENA region |
| 14 | Vietnamese | `vi` | Fast-growing digital economy |
| 15 | Indonesian | `id` | Large population; growing internet penetration |

### 7.4 Language Selection Strategy [^180^][^181^]

- **Start with 2-3 languages** (English + French + Spanish) to validate the i18n pipeline
- Check analytics for signup attempts from non-English locales
- Use machine translation (e.g., DeepL API, Google Translate) for initial translations with human review
- Prioritize languages where product-market fit exists or organic demand is visible
- Arabic requires RTL layout support and should be deferred until the UI is RTL-ready

---

## 8. Accessible Form Patterns: Error Messaging

### 8.1 Error Pattern Matrix

| Pattern | Best For | ARIA Implementation | Focus Behavior |
|---|---|---|---|
| Inline field error | Immediate validation (on blur) | `aria-invalid="true"` + `aria-describedby` | No focus movement [^150^] |
| Error summary | Multi-field form submission | `role="alert"` or `aria-live="assertive"` | Move focus to summary on submit [^148^] |
| Toast/notification | Non-form errors (network, save) | `role="alert"` | Do NOT move focus; auto-dismiss after 5s+ [^150^] |

### 8.2 Accessible Form Validation Component

```tsx
// Accessible Form Field with Error Handling
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface AccessibleFieldProps {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  validate?: (value: string) => string | undefined;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean | undefined;
    'aria-errormessage': string | undefined;
    onBlur: () => void;
  }) => React.ReactNode;
}

export const AccessibleField: React.FC<AccessibleFieldProps> = ({
  id,
  name,
  label,
  required = false,
  hint,
  validate,
  children,
}) => {
  const { t } = useTranslation('errors');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  const descriptionId = [hintId, error].filter(Boolean).join(' ') || undefined;

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validate) {
      const validationError = validate(value);
      setError(validationError || null);
    }
  }, [validate]);

  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      {/* Label with required indicator */}
      <label htmlFor={id} className="field-label">
        {label}
        {required && (
          <span className="required-indicator" aria-label={t('requiredField')}>
            *
          </span>
        )}
      </label>

      {/* Hint text */}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}

      {/* Form control rendered via render prop */}
      {children({
        id,
        'aria-invalid': !!error,
        'aria-describedby': descriptionId,
        'aria-required': required || undefined,
        'aria-errormessage': error ? errorId : undefined,
        onBlur: handleBlur,
      })}

      {/* Error message - WCAG 3.3.1, 3.3.3 */}
      {error && touched && (
        <p
          id={errorId}
          className="field-error"
          role="alert"
          aria-live="assertive"
        >
          <span className="error-icon" aria-hidden="true">&#9888;</span>
          {error}
        </p>
      )}
    </div>
  );
};

// Error message guidelines per WCAG
export const errorMessageRules = {
  // SC 3.3.3: Error Suggestion
  beSpecific: (field: string, issue: string) =>
    `${field} ${issue}`, // "Email address is missing the @ symbol"
  
  // Include format examples
  includeFormat: (field: string, format: string) =>
    `${field} must be in the format: ${format}`,
  
  // Avoid blame - use passive construction
  avoidBlame: (field: string) =>
    `The ${field} entered is not valid`, // NOT "You entered an invalid email"
  
  // Plain language - reading age ~11
  usePlainLanguage: true,
  
  // Timing: show on blur, not on every keystroke
  showOnBlur: true,
};
```

### 8.3 Error Accessibility Audit Checklist [^150^][^152^]

**Visual & Content:**
- [ ] Error communicated through text, not color alone (WCAG 1.4.1)
- [ ] Error text has >= 4.5:1 contrast ratio (WCAG 1.4.3)
- [ ] Icon or visual marker supplements color change
- [ ] Error message names the field
- [ ] Error message explains what is wrong (not just "invalid")
- [ ] Error message includes how to fix the error (WCAG 3.3.3)
- [ ] Error text does not disappear until error is resolved

**Programmatic & AT:**
- [ ] `aria-invalid="true"` set on erroneous input
- [ ] Error message linked via `aria-describedby` on input
- [ ] Error container uses `role="alert"` for form-level errors
- [ ] Error summary injected and focused on submission failure
- [ ] Error summary links navigate to corresponding form field

---

## 9. Dark Mode Accessibility: Contrast & Focus

### 9.1 Contrast Requirements Summary [^166^][^167^][^170^][^174^]

| Element | Light Theme | Dark Theme | WCAG Criterion |
|---|---|---|---|
| Normal text (< 18px) | >= 4.5:1 | >= 4.5:1 | SC 1.4.3 |
| Large text (18px+ / 14px bold) | >= 3:1 | >= 3:1 | SC 1.4.3 |
| UI component borders | >= 3:1 | >= 3:1 | SC 1.4.11 |
| Focus indicators | >= 3:1 | >= 3:1 | SC 2.4.7 |
| Icons conveying info | >= 3:1 | >= 3:1 | SC 1.4.11 |
| Inactive UI components | No requirement | No requirement | SC 1.4.3 Note |

### 9.2 CSS Custom Properties for Accessible Theming

```css
/* === DESIGN SYSTEM: Accessible Color Tokens === */

/* Light Theme */
:root {
  /* Backgrounds */
  --bg-page: #ffffff;
  --bg-surface: #f5f5f5;
  --bg-elevated: #ffffff;
  --bg-overlay: rgba(0, 0, 0, 0.5);

  /* Text: All ratios calculated against #FFFFFF or #F5F5F5 */
  --text-primary: #1a1a1a;      /* 16.6:1 vs white */
  --text-secondary: #404040;     /* 10.7:1 vs white */
  --text-tertiary: #6c6c6c;      /* 4.8:1 vs white -- minimum for captions */
  --text-disabled: #a0a0a0;      /* 2.8:1 -- only for inactive */

  /* Interactive elements */
  --border-default: #d4d4d4;     /* decorative -- no text */
  --border-strong: #767676;      /* 4.5:1 vs white -- input borders */
  --border-focus: #0066cc;       /* 7.0:1 vs white */
  --border-error: #b71c1c;       /* 7.2:1 vs white */
  
  /* Primary action */
  --action-primary-bg: #0052a3;  /* 4.9:1 white text */
  --action-primary-text: #ffffff;
  --action-primary-hover: #003d7a;
  
  /* Status colors */
  --status-success: #1a7f1a;     /* 4.3:1 vs white */
  --status-warning: #8a6d00;     /* 5.1:1 vs white */
  --status-error: #b71c1c;       /* 7.2:1 vs white */
  --status-info: #0066cc;        /* 7.0:1 vs white */

  /* Focus indicator */
  --focus-color: #0066cc;
  --focus-outline: 3px solid var(--focus-color);
  --focus-outline-offset: 2px;
}

/* Dark Theme */
[data-theme="dark"] {
  /* Backgrounds: Avoid pure black (#000) - use dark grays */
  --bg-page: #121212;            /* Material Design recommended dark bg */
  --bg-surface: #1e1e1e;
  --bg-elevated: #2d2d2d;
  --bg-overlay: rgba(0, 0, 0, 0.7);

  /* Text: Calculated against #121212 */
  --text-primary: #fafafa;       /* ~19:1 vs #121212 */
  --text-secondary: #e0e0e0;     /* ~14:1 vs #121212 */
  --text-tertiary: #a0a0a0;      /* ~5.8:1 vs #121212 -- safe minimum */
  --text-disabled: #6c6c6c;      /* ~3.8:1 -- acceptable for inactive */

  /* Interactive elements */
  --border-default: #404040;
  --border-strong: #8a8a8a;      /* ~4.5:1 vs #1e1e1e */
  --border-focus: #66b2ff;       /* ~4.7:1 vs #121212 */
  --border-error: #ff6b6b;       /* ~6.5:1 vs #121212 */
  
  /* Primary action */
  --action-primary-bg: #3399ff;  /* ~4.7:1 vs #121212 for white text */
  --action-primary-text: #121212;
  --action-primary-hover: #4dabff;

  /* Status colors */
  --status-success: #4caf50;     /* ~5.5:1 vs #121212 */
  --status-warning: #ffc107;     /* ~9.5:1 vs #121212 */
  --status-error: #ff6b6b;       /* ~6.5:1 vs #121212 */
  --status-info: #66b2ff;        /* ~4.7:1 vs #121212 */

  /* Focus indicator - must be visible on dark backgrounds */
  --focus-color: #66b2ff;
  --focus-outline: 3px solid var(--focus-color);
  --focus-outline-offset: 2px;
}
```

### 9.3 Accessible Focus Indicator Pattern

```css
/* === FOCUS INDICATORS: WCAG 2.4.7 + 2.4.11 === */

/* Base focus style - visible in both themes */
:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
}

/* Double-outline technique for maximum visibility */
/* Layers two contrasting colors to ensure visibility on any background */
.focus-double-outline:focus-visible {
  /* Inner indicator */
  outline: 2px solid #f9f9f9;
  outline-offset: 0;
  /* Outer indicator */
  box-shadow: 0 0 0 4px #193146;
}

/* Focus for dark backgrounds */
[data-theme="dark"] :focus-visible {
  outline-color: #66b2ff;  /* Light blue visible on dark */
}

/* Ensure focus visible on custom elements */
button:focus-visible,
a:focus-visible,
[tabindex="0"]:focus-visible {
  outline: 3px solid var(--focus-color);
  outline-offset: 3px;
  box-shadow: 0 0 0 1px var(--bg-page); /* Additional indicator layer */
}

/* NEVER remove focus styles without replacement */
/* WRONG: *:focus { outline: none; } */
```

### 9.4 Dark Mode Implementation in React

```tsx
// Theme toggle with persistence
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check localStorage first, then system preference
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Accessible Theme Toggle Button
export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight')}
      className="theme-toggle"
    >
      <span aria-hidden="true">{theme === 'light' ? '\u{1F319}' : '\u{2600}'}</span>
      <span className="visually-hidden">
        {theme === 'light' ? t('theme.dark') : t('theme.light')}
      </span>
    </button>
  );
};
```

### 9.5 Dark Mode Accessibility Checklist [^166^][^169^][^175^]

- [ ] All text meets 4.5:1 contrast ratio in both themes
- [ ] Focus indicators visible in both themes (test with Tab key)
- [ ] Theme toggle is keyboard accessible
- [ ] User preference persisted in `localStorage`
- [ ] `prefers-color-scheme` media query respected on first visit
- [ ] Avoid pure black (#000000) -- use #121212 or similar dark gray
- [ ] Halation effect mitigated for astigmatism (avoid pure white text on pure black)
- [ ] Test all interactive states: default, hover, active, focus, disabled

---

## 10. Screen Reader Testing Tools & Strategy

### 10.1 Testing Tool Stack [^161^][^163^][^171^]

| Layer | Tool | Purpose | Coverage |
|---|---|---|---|
| **Automated scanning** | axe DevTools, WAVE, Lighthouse | Catch structural issues, missing alt text, contrast failures | ~30-40% of issues |
| **Keyboard-only testing** | Manual (Tab key only) | Focus order, keyboard traps, focus visibility | Different class of bugs |
| **Screen reader testing** | NVDA, VoiceOver, JAWS | Announcement quality, reading order, dynamic content | Real user experience |
| **User testing** | Real AT users | Task completion rates, cognitive load, satisfaction | Gold standard |

### 10.2 Screen Reader Setup

**NVDA (Windows) -- Recommended for Testing:**
1. Download from [nvaccess.org](https://nvaccess.org) (free, open-source)
2. Best browser pairing: NVDA + Firefox or Chrome
3. Portable version available for quick testing
4. Key shortcuts:
   - `Insert + Down Arrow`: Start/stop reading
   - `H`: Next heading
   - `F`: Next form field
   - `D`: Next landmark
   - `Insert + Space`: Toggle browse/focus mode
   - `Insert + F7`: Elements list
   - `Tab`: Navigate interactive elements

**VoiceOver (macOS) -- Built In:**
1. Enable: `Command + F5`
2. Best browser pairing: VoiceOver + Safari
3. Key shortcuts:
   - `VO + Right/Left Arrow`: Read next/previous item
   - `VO + U`: Open Rotor
   - `VO + Cmd + H`: Next heading
   - `VO + Space`: Activate element
   - `VO + Shift + Down/Up Arrow`: Interact with/stop interacting with element

**JAWS (Windows) -- Professional Standard:**
- Paid software; 40-minute trial mode available
- Best browser pairing: JAWS + Chrome
- Consider testing with JAWS if targeting enterprise users

### 10.3 Screen Reader Testing Checklist [^163^][^171^]

#### First Impression Test
- [ ] Page title announced on load (should be descriptive)
- [ ] Page language announced (indicates `lang` attribute set)
- [ ] Understand what the page is about without visual context

#### Structure Exploration
- [ ] Headings present and in logical order (H1 -> H2 -> H3)
- [ ] Landmark regions identified (navigation, main, footer)
- [ ] Can build mental map of the page

#### Navigation Test
- [ ] All interactive elements reachable via Tab
- [ ] Focus order logical and matches visual order
- [ ] Focus indicators visible on all interactive elements
- [ ] No keyboard traps (can Tab away from everything)
- [ ] Skip link present and functional (bypass blocks)

#### Content Test
- [ ] Images have meaningful alt text
- [ ] Lists announced as lists with item count
- [ ] Tables have headers announced
- [ ] Content makes sense without visual context

#### Interactive Component Test
- [ ] Upload: Drop zone announces label and instructions
- [ ] Processing: Status changes announced via live region
- [ ] Layer list: Can navigate and select layers via keyboard
- [ ] Download: Button action clearly announced
- [ ] Forms: Error messages announced and associated with fields

### 10.4 Screen Reader Bug Template

When logging screen reader bugs, include:
- Screen reader and version (e.g., NVDA 2024.1)
- Browser and version (e.g., Firefox 124)
- Exact announcement heard
- Expected announcement
- Steps to reproduce

---

## 11. Keyboard Navigation Mapping

### 11.1 Global Navigation

| Key | Action |
|---|---|
| `Tab` | Move to next interactive element |
| `Shift + Tab` | Move to previous interactive element |
| `Enter` / `Space` | Activate focused element |
| `Escape` | Close modals, cancel current operation |
| `?` | Open keyboard shortcuts help |

### 11.2 Upload Area

| Key | Action |
|---|---|
| `Tab` | Focus upload drop zone |
| `Enter` / `Space` | Open file picker dialog |

### 11.3 Processing Status

| Key | Action |
|---|---|
| No keyboard actions | Status is informational only |

### 11.4 SVG Layer Editor

| Key | Action |
|---|---|
| `Tab` | Enter/exit layer list |
| `Arrow Up` / `Arrow Down` | Navigate between layers |
| `Home` / `End` | Go to first/last layer |
| `Space` / `Enter` | Select layer |
| `V` | Toggle layer visibility |
| `L` | Toggle layer lock |
| `Delete` / `Backspace` | Delete layer |
| `Alt + Arrow Up` / `Arrow Down` | Reorder layer |

### 11.5 SVG Preview

| Key | Action |
|---|---|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom and pan |
| `Ctrl + Arrow keys` | Pan view |

### 11.6 Download

| Key | Action |
|---|---|
| `Tab` | Focus download button |
| `Enter` / `Space` | Trigger download |

---

## 12. Implementation Quick Reference

### 12.1 Critical ARIA Attributes by Component

```tsx
// Upload Drop Zone
div({ role: 'button', tabIndex: 0, 'aria-label': '', 'aria-describedby': '', 'aria-invalid': false })

// Processing Status
div({ role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 50, 'aria-valuetext': '' })
div({ 'aria-live': 'polite', 'aria-atomic': true })

// Layer List
ul({ role: 'tree', 'aria-multiselectable': false })
li({ role: 'treeitem', tabIndex: -1, 'aria-selected': false, 'aria-label': '' })

// SVG Preview
svg({ role: 'img', 'aria-labelledby': 'title-id desc-id' })
canvas({ role: 'img', 'aria-label': '' })

// Form Fields
input({ 'aria-invalid': true, 'aria-describedby': 'error-id', 'aria-required': true, 'aria-errormessage': 'error-id' })

// Error Messages
div({ role: 'alert', 'aria-live': 'assertive' })
```

### 12.2 Translation Key Naming Convention

```
{namespace}:{feature}.{element}.{property}

Examples:
  upload:dropZone.ariaLabel
  upload:errors.fileTooLarge
  processing:stages.vectorizing
  editor:layers.keyboardHelp
  download:button.label
  common:theme.switchToDark
```

### 12.3 WCAG 2.1 AA Quick Compliance Checklist

- [ ] Text alternatives for all non-text content (SC 1.1.1)
- [ ] Color not sole means of conveying info (SC 1.4.1)
- [ ] All text >= 4.5:1 contrast (SC 1.4.3)
- [ ] UI components >= 3:1 contrast (SC 1.4.11)
- [ ] All functionality keyboard accessible (SC 2.1.1)
- [ ] No keyboard traps (SC 2.1.2)
- [ ] Visible focus indicator (SC 2.4.7)
- [ ] Page language declared (SC 3.1.1)
- [ ] Error identification in text (SC 3.3.1)
- [ ] Error suggestions provided (SC 3.3.3)
- [ ] Name, role, value exposed (SC 4.1.2)
- [ ] Status messages announced (SC 4.1.3)

---

## Citations

| Ref | Source | Description |
|---|---|---|
| [^134^] | Link Electronics | WCAG 2.1 AA overview, POUR principles, 50 success criteria |
| [^135^] | PMC Services | Key requirements: contrast, keyboard, text alternatives, forms |
| [^136^] | A11y Collective | SVG accessibility: contrast, tabindex, ARIA, keyboard patterns |
| [^138^] | Innowise | Detailed WCAG 2.1 AA criteria table under EAA |
| [^139^] | NC DPI | POUR principles and key success criteria |
| [^140^] | Queensland Gov Design System | File upload ARIA patterns, drag-drop accessibility |
| [^141^] | W3C WCAG 2.1 Spec | Official WCAG 2.1 specification |
| [^142^] | Escribe Meetings | WCAG 2.1 AA for government portals |
| [^144^] | Almero Steyn Blog | ARIA live regions in React implementation |
| [^145^] | W3C SVG Accessibility Wiki | SVG navigation, keyboard commands |
| [^146^] | Abbey Perini (Dev.to) | Live regions in React, aria-live values |
| [^147^] | AppInstitute | Drag-and-drop accessibility validation checklist |
| [^148^] | Reform Blog | Accessible form validation best practices |
| [^149^] | Pope Tech Blog | Accessible form validation with code examples |
| [^150^] | AIOps Group | Accessible error messages: complete guide with patterns |
| [^151^] | shadcn/ui GitHub | ARIA form validation bug: aria-describedby, role=alert |
| [^152^] | TetraLogical | Form validation and error messages foundations |
| [^153^] | SimpleLocalize | i18n for SaaS teams: ICU support, TypeScript, namespaces |
| [^154^] | PaulJAdam Demos | Canvas element accessibility techniques |
| [^155^] | Level Access | ARIA explained: versions, testing, live regions |
| [^156^] | Medium (Deepbig) | react-i18next guide: interpolation, plurals |
| [^158^] | WebYes | SVG text alternative techniques |
| [^159^] | WebAIM | Form validation and error recovery |
| [^160^] | Localazy | Pluralization in software localization |
| [^161^] | Dev.to (r3ticular) | Screen reader testing: announcement quality |
| [^162^] | W3C WCAG 3.0 | Focus indicator contrast requirements |
| [^163^] | AChecker | Screen reader testing complete guide |
| [^164^] | TestMuAI | Focus Visible (2.4.7) requirements |
| [^166^] | AccessibilityChecker | Dark mode accessibility guide |
| [^167^] | AllAccessible | Color contrast WCAG guide with code examples |
| [^168^] | W3C Understanding SC 1.4.3 | Contrast minimum official understanding |
| [^169^] | A11y Collective | Focus indicators: creation and best practices |
| [^170^] | U of Arizona | Color contrast guidance, tools |
| [^171^] | TestParty | Screen reader testing practical guide |
| [^172^] | AllAccessible | WCAG 2.4.13 focus appearance guide |
| [^173^] | AARDVARK | Focus appearance simplified explanation |
| [^174^] | TestParty | Color contrast requirements guide |
| [^175^] | Medium | Designing accessible dark mode (WCAG compliant) |
| [^177^] | Milvus | SaaS multi-language support approaches |
| [^178^] | W3C SVG-AAM | SVG Accessibility API Mappings specification |
| [^179^] | SimpleLocalize | Technical guide to i18n & localization |
| [^180^] | TAIA | SaaS localization platform FAQ |
| [^181^] | LeanVibe | Making SaaS multilingual: implementation guide |
| [^182^] | WAI-ARIA Practices | ARIA Authoring Practices Guide |
| [^183^] | W3C WAI-ARIA 1.3 | Accessible Rich Internet Applications 1.3 spec |
| [^184^] | Level Access | ARIA guidance: beginner's guide to WAI-ARIA |
| [^185^] | W3C WAI-ARIA 1.0 | Authoring Practices (drag-and-drop section) |
| [^186^] | Phrase Blog | React localization with i18next tutorial |
| [^187^] | i18next Docs | Configuration options reference |
| [^189^] | Crowdin Blog | React i18n with i18next: expert tutorial |
| [^191^] | i18next Docs | Fallback mechanism documentation |
