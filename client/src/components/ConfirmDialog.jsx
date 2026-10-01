import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Small modal confirmation. Cancel is focused first so a stray tap never confirms.
export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(e) => e.stopPropagation()}>
        <span className="dialog-icon"><Icon name="trash" /></span>
        <h2 id="dialog-title">{title}</h2>
        <div className="lead">{children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="big secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="big stop" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
