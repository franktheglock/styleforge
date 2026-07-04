// Shared drag state for cross-component drag-and-drop.
// Bypasses e.dataTransfer.getData() unreliability in Tauri WebView2.
//
// IMPORTANT: subscribers are notified via requestAnimationFrame so that
// dragstart can complete before any React re-renders happen (synchronous
// re-renders during dragstart cancel the drag in WebView2).

let _payload = '';

export function startDrag(payload: string) {
  _payload = payload;
  console.log('[DRAGSTATE] startDrag', { payload });
}

export function getDragPayload(): string {
  return _payload;
}

export function clearDragPayload() {
  console.log('[DRAGSTATE] clearDragPayload');
  _payload = '';
}
