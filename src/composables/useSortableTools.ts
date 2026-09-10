import { onBeforeUnmount, onMounted } from 'vue'
import Sortable from 'sortablejs'
import { useToolOrder } from './useToolOrder'

export function useSortableTools(getElement: () => HTMLElement | null | undefined) {
  const { moveTool } = useToolOrder()
  let sortable: Sortable | undefined
  let originalNextSibling: ChildNode | null = null

  onMounted(() => {
    const element = getElement()
    if (!element) return
    sortable = new Sortable(element, {
      draggable: '[data-tool-key]',
      dataIdAttr: 'data-tool-key',
      handle: '.tool-drag-handle',
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
      ghostClass: 'tool-sort-ghost',
      chosenClass: 'tool-sort-chosen',
      fallbackClass: 'tool-sort-fallback',
      fallbackTolerance: 5,
      // Use the same drag behavior for mouse, pen and touch input.
      forceFallback: true,
      onChoose(event) {
        originalNextSibling = event.item.nextSibling
      },
      onEnd(event) {
        // Undo Sortable's DOM move before Vue applies the new keyed order.
        event.from.insertBefore(event.item, originalNextSibling)
        const key = event.item.dataset.toolKey
        if (key && event.newDraggableIndex !== undefined) moveTool(key, event.newDraggableIndex)
      },
    })
  })

  onBeforeUnmount(() => sortable?.destroy())
}
