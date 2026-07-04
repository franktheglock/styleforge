// Custom pointer-based drag-and-drop for Tauri WebView2.
// The browser's native HTML5 drag API fires dragstart then immediately dragend
// in WebView2, so we implement drag using pointer events instead.

type DragSource = 'token' | 'reorder';
type DragEndCallback = (targetSectionId: string | null, payload: string, source: DragSource) => void;

let _active = false;
let _payload = '';
let _source: DragSource = 'token';
let _ghost: HTMLDivElement | null = null;
let _hoveredSectionId: string | null = null;
let _onEnd: DragEndCallback | null = null;

const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

function _onMove(e: PointerEvent) {
  if (!_active || !_ghost) return;

  _ghost.style.left = `${e.clientX + 12}px`;
  _ghost.style.top = `${e.clientY + 12}px`;

  _ghost.style.visibility = 'hidden';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  _ghost.style.visibility = 'visible';

  const sectionRoot = (el as HTMLElement | null)?.closest('[data-section-root]') as HTMLElement | null;
  const newHoveredId = sectionRoot?.dataset.sectionId ?? null;

  if (newHoveredId !== _hoveredSectionId) {
    document
      .querySelectorAll<HTMLElement>('[data-section-root][data-section-drag-over="true"]')
      .forEach((n) => (n.dataset.sectionDragOver = 'false'));
    _hoveredSectionId = newHoveredId;
    if (sectionRoot && newHoveredId) {
      sectionRoot.dataset.sectionDragOver = 'true';
    }
  }
}

function _finish(_e: PointerEvent, dropped: boolean) {
  if (!_active) return;
  _active = false;

  if (_ghost && _ghost.parentNode) {
    _ghost.parentNode.removeChild(_ghost);
  }
  _ghost = null;

  document.removeEventListener('pointermove', _onMove, true);
  document.removeEventListener('pointerup', _onUp, true);
  document.removeEventListener('pointercancel', _onUp, true);

  const targetSectionId = dropped ? _hoveredSectionId : null;

  document
    .querySelectorAll<HTMLElement>('[data-section-root][data-section-drag-over="true"]')
    .forEach((n) => (n.dataset.sectionDragOver = 'false'));
  _hoveredSectionId = null;

  const payload = _payload;
  const source = _source;
  _payload = '';
  _source = 'token';
  const onEnd = _onEnd;
  _onEnd = null;

  if (dropped && targetSectionId && payload && onEnd) {
    onEnd(targetSectionId, payload, source);
  }

  _notify();
}

function _onUp(e: PointerEvent) {
  _finish(e, true);
}

function _onCancel(e: PointerEvent) {
  _finish(e, false);
}

export function startPointerDrag(
  source: DragSource,
  payload: string,
  sourceEl: HTMLElement,
  onEnd: DragEndCallback
) {
  if (_active) return;
  _active = true;
  _payload = payload;
  _source = source;
  _onEnd = onEnd;

  const rect = sourceEl.getBoundingClientRect();
  _ghost = document.createElement('div');
  _ghost.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgb(99, 102, 241);
    border-radius: 4px;
    color: rgb(165, 180, 252);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    transition: none;
  `;
  _ghost.textContent = payload.replace(/^(token|reorder):/, '');
  document.body.appendChild(_ghost);

  document.addEventListener('pointermove', _onMove, true);
  document.addEventListener('pointerup', _onUp, true);
  document.addEventListener('pointercancel', _onCancel, true);

  _notify();
}

export function isPointerDragActive(): boolean {
  return _active;
}

export function getPointerDragPayload(): string {
  return _payload;
}

export function getHoveredSectionId(): string | null {
  return _hoveredSectionId;
}

export function subscribePointerDrag(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
