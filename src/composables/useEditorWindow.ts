import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

interface DocumentPictureInPicture {
  requestWindow(options: { width: number; height: number }): Promise<Window>
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
  const isFullscreen = ref(false)
  const canFullscreen = computed(() => mode.value !== 'pip' && Boolean(shell.value?.ownerDocument.fullscreenEnabled))
  let detached: Window | undefined
  let originalParent: HTMLElement | null = null
  let stopMirroring: (() => void) | undefined
  let disposed = false

  const updateFullscreen = () => { isFullscreen.value = Boolean(shell.value?.ownerDocument.fullscreenElement) }

  function restore() {
    const previous = detached
    detached = undefined
    previous?.removeEventListener('pagehide', restore)
    previous?.document.removeEventListener('fullscreenchange', updateFullscreen)
    stopMirroring?.()
    stopMirroring = undefined
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
    const previous = detached
    restore()
    previous?.close()
  }

  function returnToPage() {
    closeWindow()
    window.focus()
  }

  function focusWindow() { detached?.focus() }

  async function openWindow(kind: 'pip' | 'popup') {
    if (disposed || opening.value || !shell.value) return
    if (detached && !detached.closed) { detached.focus(); return }
    error.value = ''
    opening.value = true
    let child: Window | null = null
    try {
      if (kind === 'pip') {
        if (!canPin || !pip) throw new Error('当前浏览器不支持置顶小窗，请使用独立窗口。')
        // This must run directly in the click handler to retain user activation.
        child = await pip.requestWindow({ width: 800, height: 640 })
      } else {
        child = window.open('', '_blank', 'popup=yes,width=960,height=720,resizable=yes,scrollbars=yes')
        if (!child) throw new Error('新窗口被浏览器拦截，请允许本站弹出窗口后重试。')
      }
      if (disposed || !shell.value || child.closed) { child.close(); return }
      // about:blank starts in quirks mode in some browsers. Only this fixed shell is written;
      // the user's text stays in the existing editor DOM and never enters HTML source.
      child.document.open()
      child.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>')
      child.document.close()
      detached = child
      originalParent = shell.value.parentElement
      stopMirroring = mirrorPresentation(child.document)
      child.document.body.classList.add('editor-window-document')
      mode.value = kind
      child.addEventListener('pagehide', restore, { once: true })
      child.document.addEventListener('fullscreenchange', updateFullscreen)
      // Keeping this subtree and EditorView alive preserves query, selection and undo history.
      child.document.body.append(shell.value)
      onDocumentChange(child.document)
      updateFullscreen()
      child.focus()
    } catch (reason) {
      closeWindow()
      if (child && !child.closed) child.close()
      if (!disposed) error.value = reason instanceof Error && !(reason instanceof DOMException)
        ? reason.message
        : '浏览器未允许打开置顶小窗，可以尝试普通独立窗口。'
    } finally {
      opening.value = false
    }
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

  return { canPin, mode, opening, error, isFullscreen, canFullscreen, openWindow, returnToPage, focusWindow, toggleFullscreen }
}
