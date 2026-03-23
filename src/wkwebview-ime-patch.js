/**
 * WKWebView Korean IME Patch for xterm.js
 * Based on xterm.js PR #5704 by minemos
 * https://github.com/xtermjs/xterm.js/pull/5704
 *
 * WKWebView does not fire compositionstart/compositionupdate/compositionend
 * for Korean IME. Instead it fires insertReplacementText. This patch
 * intercepts those events on the xterm textarea and handles them properly.
 */
export function applyWkWebViewImePatch(term) {
  // Only apply on WKWebView (Safari/Tauri macOS)
  const isWKWebView = /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  if (!isWKWebView) return;

  const textarea = term.textarea;
  if (!textarea) return;

  let composing = false;
  let pending = '';
  let lastCompositionPreview = '';

  function isHangul(text) {
    if (!text) return false;
    const cp = text.codePointAt(0);
    return (cp >= 0x1100 && cp <= 0x11FF) ||   // Hangul Jamo
           (cp >= 0x3130 && cp <= 0x318F) ||   // Hangul Compatibility Jamo
           (cp >= 0xAC00 && cp <= 0xD7AF) ||   // Hangul Syllables
           (cp >= 0xA960 && cp <= 0xA97F) ||   // Hangul Jamo Extended-A
           (cp >= 0xD7B0 && cp <= 0xD7FF);     // Hangul Jamo Extended-B
  }

  function flush() {
    if (pending) {
      // Send the completed syllable to PTY via xterm's onData
      const data = pending;
      pending = '';
      composing = false;
      lastCompositionPreview = '';
      // Use the core input handler
      term._core.coreService.triggerDataEvent(data, true);
    } else {
      composing = false;
      lastCompositionPreview = '';
    }
  }

  // Intercept beforeinput for insertReplacementText
  textarea.addEventListener('beforeinput', (ev) => {
    if (ev.inputType === 'insertReplacementText' && ev.data) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      composing = true;
      pending = ev.data;
      // Show composition preview in terminal
      if (lastCompositionPreview) {
        // Erase previous preview
        term.write('\x1b[D\x1b[P');
      }
      term.write(ev.data);
      lastCompositionPreview = ev.data;
      return;
    }

    // Hangul insertText — buffer it instead of letting xterm send immediately
    if (ev.inputType === 'insertText' && ev.data && isHangul(ev.data)) {
      if (composing && pending) {
        // Flush previous composed syllable (erase preview, send data)
        if (lastCompositionPreview) {
          term.write('\x1b[D\x1b[P');
        }
        const data = pending;
        pending = '';
        lastCompositionPreview = '';
        term._core.coreService.triggerDataEvent(data, true);
      }
      // Start new composition
      ev.preventDefault();
      ev.stopImmediatePropagation();
      composing = true;
      pending = ev.data;
      term.write(ev.data);
      lastCompositionPreview = ev.data;
      return;
    }

    // Non-Hangul insertText — flush pending composition first
    if (ev.inputType === 'insertText' && composing && pending) {
      if (lastCompositionPreview) {
        term.write('\x1b[D\x1b[P');
      }
      const data = pending;
      pending = '';
      composing = false;
      lastCompositionPreview = '';
      term._core.coreService.triggerDataEvent(data, true);
      // Let the normal insertText proceed
    }
  }, true); // capture phase

  // Flush on keydown (non-IME key, keyCode !== 229)
  textarea.addEventListener('keydown', (ev) => {
    if (composing && ev.keyCode !== 229) {
      if (lastCompositionPreview) {
        term.write('\x1b[D\x1b[P');
      }
      flush();
    }
  }, true); // capture phase

  // Flush on Enter specifically
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && composing && pending) {
      if (lastCompositionPreview) {
        term.write('\x1b[D\x1b[P');
      }
      flush();
    }
  }, true);

  console.log('[WKWebView IME Patch] Applied for Korean input');
}
