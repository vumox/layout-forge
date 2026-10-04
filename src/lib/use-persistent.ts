import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { rememberState, sharedState } from "./share"

export function usePersistent<T extends object>(key: string, initial: T, hydrate?: (stored: T) => T) {
  const [value, setValue] = useState<T>(() => {
    const shared = sharedState(key, initial)
    if (shared) return shared
    try {
      const raw = localStorage.getItem(key)
      const stored = raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial
      return hydrate ? hydrate(stored) : stored
    } catch {
      return initial
    }
  })
  useLayoutEffect(() => rememberState(key, value), [key, value])
  useEffect(() => {
    const onHash = () => {
      const shared = sharedState(key, initial)
      if (shared) setValue(shared)
    }
    addEventListener("hashchange", onHash)
    return () => removeEventListener("hashchange", onHash)
  }, [key, initial])
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        return
      }
    }, 300)
    return () => clearTimeout(t)
  }, [key, value])
  const patch = useCallback((p: Partial<T>) => setValue((v) => ({ ...v, ...p })), [])
  return [value, patch, setValue] as const
}
