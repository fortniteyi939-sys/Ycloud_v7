import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Datos, Resultado } from '../types'
import { cargarTodo } from '../services/repositorio'
import { useToast } from '../components/Toast'

interface DatosCtx {
  datos: Datos
  /** Ejecuta una operación contra Supabase (que valida y guarda) y, si sale bien, vuelve a leer los datos. Devuelve true/false. */
  ejecutar: (operacion: (actual: Datos) => Promise<Resultado>) => Promise<boolean>
  /** Vuelve a leer todo desde Supabase. */
  recargar: () => Promise<void>
}
const Ctx = createContext<DatosCtx | null>(null)

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error desconocido')

export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const avisar = useToast()

  const recargar = useCallback(async () => {
    try { setDatos(await cargarTodo()); setError('') } catch (e) { setError(mensaje(e)) }
  }, [])

  useEffect(() => { void recargar() }, [recargar])

  const ejecutar = useCallback(async (operacion: (actual: Datos) => Promise<Resultado>) => {
    if (!datos) return false
    try {
      const r = await operacion(datos)
      avisar(r.mensaje, !r.ok)
      if (r.ok) setDatos(await cargarTodo())
      return r.ok
    } catch (e) {
      avisar(mensaje(e), true)
      await recargar()
      return false
    }
  }, [datos, avisar, recargar])

  if (error) return (
    <div className="auth"><div className="c pad">
      <b>No se pudieron cargar los datos desde Supabase</b>
      <p className="mut">{error}</p>
      <p className="mut">Verifica que ejecutaste <code>01_esquema_erp.sql</code> en Supabase, que las variables VITE_SUPABASE_* son correctas y que tu rol tiene permiso de lectura.</p>
      <button className="pri" onClick={() => void recargar()}>Reintentar</button>
    </div></div>
  )
  if (!datos) return <div className="auth"><p className="mut">Cargando datos…</p></div>
  return <Ctx.Provider value={{ datos, ejecutar, recargar }}>{children}</Ctx.Provider>
}

export function useDatos() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDatos debe usarse dentro de DatosProvider')
  return c
}
