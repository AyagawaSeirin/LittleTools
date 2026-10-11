import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

interface DocumentPictureInPicture {
  requestWindow(options: { width: number; height: number }): Promise<Window>
}

interface EditorWindowSession {
  window: Window
  document: Document
  stopMirroring: () => void
  onPageHide: () => void
}

/** Copy only presentation, never document content, to the temporary window. */
function mirrorPresentation(target: Document) {
  const base = target.createElement('base')
  base.href = document.baseURI
  target.head.append(base)
  target.title = '在线文本编辑器 · LittleTools'
  let copiedStyles: HTMLElement[] = []
  const syncStyles = () => {
    const styles: HTMLElement[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      if (sheet.disabled) continue
      try {
        const style = target.createElement('style')
        style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
        style.media = sheet.media.mediaText
        styles.push(style)
      } catch {
        if (!sheet.href) continue
        const link = target.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        link.media = sheet.media.mediaText
        styles.push(link)
      }
    }
    copiedStyles.forEach((style) => style.remove())
    target.head.append(...styles)
    copiedStyles = styles
  }
  const syncTheme = () => {
    for (const name of ['lang', 'class', 'style', 'data-theme']) {
      const value = document.documentElement.getAttribute(name)
      if (value === null) target.documentElement.removeAttribute(name)
      else target.documentElement.setAttribute(name, value)
    }
  }
  syncStyles()
  syncTheme()
  // Ant Design injects styles on demand, including when the user switches themes.
  const stylesObserver = new MutationObserver(syncStyles)
  stylesObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'] })
  const themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'class', 'style', 'data-theme'] })
  return () => {
    stylesObserver.disconnect()
    themeObserver.disconnect()
    copiedStyles = []
  }
}

export function useEditorWindow(shell: Ref<HTMLElement | null>, onDocumentChange: (owner: Document) => void) {
  const pip = (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture
  const canPin = Boolean(window.isSecureContext && window.top === window && pip)
  const mode = ref<'pip' | 'popup' | null>(null)
  const opening = ref(false)
  const error = ref('')
  const pinConfirmationNeeded = ref(false)
  const isFullscreen = ref(false)
  const canFullscreen = computed(() => mode.value !== 'pip' && Boolean(shell.value?.ownerDocument.fullscreenEnabled))
  let active: EditorWindowSession | undefined
  let originalParent: HTMLElement | null = null
  let disposed = false
  let transition = 0

  const updateFullscreen = () => { isFullscreen.value = Boolean(shell.value?.ownerDocument.fullscreenElement) }

  function release(session: EditorWindowSession) {
    session.window.removeEventListener('pagehide', session.onPageHide)
    session.document.removeEventListener('fullscreenchange', updateFullscreen)
    session.stopMirroring()
  }

  function restore() {
    transition += 1
    opening.value = false
    pinConfirmationNeeded.value = false
    const previous = active
    active = undefined
    if (previous) release(previous)
    mode.value = null
    if (shell.value && originalParent) {
      // Move the existing Vue subtree back synchronously, before the child is destroyed.
      originalParent.append(shell.value)
      onDocumentChange(document)
    }
    originalParent = null
    updateFullscreen()
  }

  function closeWindow() {
    const previous = active
    restore()
    previous?.window.close()
  }

  function returnToPage() {
    closeWindow()
    window.focus()
  }

  function focusWindow() { active?.window.focus() }

  async function changeWindow(kind: 'pip' | 'popup') {
    if (disposed || opening.value || !shell.value) return
    if (mode.value === kind && active && !active.window.closed) { focusWindow(); return }
    error.value = ''
    pinConfirmationNeeded.value = false
    opening.value = true
    const revision = ++transition
    const previous = active
    const previousParent = shell.value.parentElement
    const previousDocument = shell.value.ownerDocument
    const width = Math.max(320, Math.round(previous?.window.innerWidth || 800))
    const height = Math.max(240, Math.round(previous?.window.innerHeight || 640))
    let child: Window | null = null
    let candidate: EditorWindowSession | undefined
    let transferred: EditorWindowSession | undefined
    let phase: 'request' | 'prepare' = 'request'
    try {
      if (kind === 'pip') {
        if (!canPin || !pip) throw new Error('Picture-in-Picture unavailable')
        // This must run directly in the click handler to retain user activation.
        child = await pip.requestWindow({ width, height })
      } else {
        const position = previous ? `,left=${Math.round(previous.window.screenX)},top=${Math.round(previous.window.screenY)}` : ''
        child = window.open('', '_blank', `popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes${position}`)
        if (!child) throw new Error('Popup blocked')
      }
      if (disposed || revision !== transition || !shell.value || child.closed) { child.close(); return }
      phase = 'prepare'
      // about:blank starts in quirks mode in some browsers. Only this fixed shell is written;
      // the user's text stays in the existing editor DOM and never enters HTML source.
      child.document.open()
      child.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>')
      child.document.close()
      const session: EditorWindowSession = {
        window: child,
        document: child.document,
        stopMirroring: mirrorPresentation(child.document),
        onPageHide: () => {
          // An old window closing after a pin switch must not reclaim the new editor.
          if (active === session) restore()
        },
      }
      candidate = session
      child.document.body.classList.add('editor-window-document')
      child.addEventListener('pagehide', session.onPageHide, { once: true })
      child.document.addEventListener('fullscreenchange', updateFullscreen)
      // Keeping this subtree and EditorView alive preserves query, selection and undo history.
      const scrollPositions = [shell.value, ...shell.value.querySelectorAll<HTMLElement>('.cm-scroller')]
        .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }))
      child.document.body.append(shell.value)
      onDocumentChange(child.document)
      const restoreScroll = () => scrollPositions.forEach(({ element, top, left }) => element.scrollTo(left, top))
      restoreScroll()
      child.requestAnimationFrame(() => { if (active === session) restoreScroll() })
      originalParent ??= previousParent
      active = session
      mode.value = kind
      updateFullscreen()
      transferred = session
    } catch {
      if (candidate) release(candidate)
      if (!disposed && revision === transition && candidate && shell.value && previousParent && shell.value.ownerDocument === candidate.document) {
        previousParent.append(shell.value)
        onDocumentChange(previousDocument)
      }
      if (child && !child.closed) child.close()
      if (!disposed && revision === transition) {
        error.value = phase === 'prepare'
          ? '窗口切换失败，原窗口和编辑内容已保留，请重试。'
          : kind === 'pip'
            ? '浏览器未允许置顶，当前窗口和编辑内容已保留。'
            : '新窗口被浏览器拦截，请允许本站弹出窗口后重试。当前窗口和编辑内容已保留。'
      }
    } finally {
      if (revision === transition) opening.value = false
    }
    // Close the old native window only after the transfer has committed. Request/setup
    // failures above leave the previous session's listeners, styles and editor intact.
    if (transferred) {
      if (previous) { release(previous); previous.window.close() }
      transferred.window.focus()
    }
  }

  function openWindow() {
    if (active && !active.window.closed) { focusWindow(); return }
    return changeWindow(canPin ? 'pip' : 'popup')
  }

  function togglePin() {
    if (!active || !canPin || isFullscreen.value || opening.value) return
    error.value = ''
    // A normal popup's click does not activate its opener. Unlike PiP -> popup, repinning
    // sometimes needs one trusted click in the original tab; do not try to fake activation.
    if (mode.value === 'popup' && !window.navigator.userActivation?.isActive) {
      pinConfirmationNeeded.value = true
      window.focus()
      return
    }
    return changeWindow(mode.value === 'pip' ? 'popup' : 'pip')
  }

  async function toggleFullscreen() {
    const element = shell.value
    if (!element || mode.value === 'pip') return
    error.value = ''
    try {
      if (element.ownerDocument.fullscreenElement) await element.ownerDocument.exitFullscreen()
      else await element.requestFullscreen()
    } catch {
      error.value = '浏览器未允许全屏，请使用浏览器或系统的全屏操作。'
    }
    updateFullscreen()
  }

  document.addEventListener('fullscreenchange', updateFullscreen)
  window.addEventListener('beforeunload', closeWindow)
  window.addEventListener('pagehide', closeWindow)
  onBeforeUnmount(() => {
    disposed = true
    closeWindow()
    document.removeEventListener('fullscreenchange', updateFullscreen)
    window.removeEventListener('beforeunload', closeWindow)
    window.removeEventListener('pagehide', closeWindow)
  })

  return { canPin, mode, opening, error, pinConfirmationNeeded, isFullscreen, canFullscreen, openWindow, togglePin, returnToPage, focusWindow, toggleFullscreen }
}
