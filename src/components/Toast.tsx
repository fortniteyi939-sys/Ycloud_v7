import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const Ctx = createContext<(mensaje: string, error?: boolean) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ mensaje: string; error: boolean } | null>(null)
  const timer = useRef<number>()
  const avisar = useCallback((mensaje: string, error = false) => {
    setT({ mensaje, error })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setT(null), 2800)
  }, [])
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div id="ts" className={t?.error ? 'e' : ''} style={{ display: t ? 'block' : 'none' }}>{t?.mensaje}</div>
    </Ctx.Provider>
  )
}
