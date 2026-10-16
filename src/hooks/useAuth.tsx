import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Perfil } from '../types'
import { supabase } from '../services/supabase'
import { login, logout, obtenerPerfil, registro, type Respuesta } from '../services/auth'

interface AuthCtx {
  cargando: boolean
  perfil: Perfil | null
  iniciarSesion: (email: string, pass: string) => Promise<Respuesta>
  registrarse: (nombres: string, email: string, pass: string) => Promise<Respuesta>
  cerrarSesion: () => Promise<void>
}
const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (userId: string): Promise<Respuesta> => {
    const r = await obtenerPerfil(userId)
    if (r.perfil) setPerfil(r.perfil)
    return r.error ? { error: r.error } : {}
  }, [])

  useEffect(() => {
    if (!supabase) { setCargando(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await cargarPerfil(data.session.user.id)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') setPerfil(null) })
    return () => data.subscription.unsubscribe()
  }, [cargarPerfil])

  const iniciarSesion = async (email: string, pass: string) => {
    const r = await login(email, pass)
    return r.userId ? cargarPerfil(r.userId) : r
  }
  const registrarse = async (nombres: string, email: string, pass: string) => {
    const r = await registro(nombres, email, pass)
    return r.userId ? cargarPerfil(r.userId) : r
  }
  const cerrarSesion = async () => { await logout(); setPerfil(null) }

  return <Ctx.Provider value={{ cargando, perfil, iniciarSesion, registrarse, cerrarSesion }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return c
}
