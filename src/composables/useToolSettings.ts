import { watch, type Ref } from 'vue'

interface FieldCodec {
  serialize?: (value: any) => unknown
  deserialize?: (value: unknown) => any
}

type FieldMap = Record<string, Ref<any>>

export function rememberToolSettings(
  toolKey: string,
  fields: FieldMap,
  codecs: Record<string, FieldCodec> = {},
) {
  const storageKey = `little-tools:v1:${toolKey}`

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, unknown>
    Object.entries(fields).forEach(([name, field]) => {
      if (!Object.prototype.hasOwnProperty.call(saved, name)) return
      field.value = codecs[name]?.deserialize?.(saved[name]) ?? saved[name]
    })
  } catch {
    localStorage.removeItem(storageKey)
  }

  watch(
    Object.values(fields),
    () => {
      const state = Object.fromEntries(Object.entries(fields).map(([name, field]) => [
        name,
        codecs[name]?.serialize?.(field.value) ?? field.value,
      ]))
      localStorage.setItem(storageKey, JSON.stringify(state))
    },
    { deep: true, flush: 'post' },
  )
}
