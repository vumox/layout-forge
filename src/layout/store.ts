import { produce } from "immer"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { rememberState, sharedState } from "@/lib/share"
import { normalizeDraft } from "@/layout/tree"
import type { LayoutNode } from "@/layout/types"

interface History {
  past: LayoutNode[]
  present: LayoutNode
  future: LayoutNode[]
  lastKey?: string
  lastTime: number
}

export type Recipe = (draft: LayoutNode) => void | LayoutNode

function load(key: string): LayoutNode | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LayoutNode
    return parsed && parsed.id && Array.isArray(parsed.children) ? parsed : null
  } catch {
    return null
  }
}

export function useLayoutDoc(storageKey: string, initial: () => LayoutNode) {
  const [h, setH] = useState<History>(() => ({ past: [], present: sharedState(storageKey, initial()) ?? load(storageKey) ?? initial(), future: [], lastTime: 0 }))
  useLayoutEffect(() => rememberState(storageKey, h.present), [storageKey, h.present])
  useEffect(() => {
    const onHash = () => {
      const shared = sharedState(storageKey, initial())
      if (shared) setH({ past: [], present: shared, future: [], lastTime: 0 })
    }
    addEventListener("hashchange", onHash)
    return () => removeEventListener("hashchange", onHash)
  }, [storageKey, initial])

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(h.present))
      } catch {
        return
      }
    }, 300)
    return () => clearTimeout(t)
  }, [h.present, storageKey])

  const commit = useCallback((recipe: Recipe, key?: string) => {
    setH((s) => {
      const changed = produce(s.present, recipe as (d: LayoutNode) => void)
      const next = produce(changed, (d) => {
        normalizeDraft(d)
      })
      if (next === s.present) return s
      const now = Date.now()
      const merge = key !== undefined && key === s.lastKey && now - s.lastTime < 1000
      return {
        past: merge ? s.past : [...s.past.slice(-99), s.present],
        present: next,
        future: [],
        lastKey: key,
        lastTime: now,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setH((s) =>
      s.past.length === 0
        ? s
        : { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], lastTime: 0 },
    )
  }, [])

  const redo = useCallback(() => {
    setH((s) =>
      s.future.length === 0 ? s : { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), lastTime: 0 },
    )
  }, [])

  return {
    root: h.present,
    commit,
    undo,
    redo,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }
}

export type LayoutDoc = ReturnType<typeof useLayoutDoc>
