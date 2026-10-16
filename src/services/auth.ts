import { supabase } from './supabase'
import type { Perfil } from '../types'

const ERRORES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Debes confirmar tu correo antes de iniciar sesión.'],
  [/already registered|already been registered/i, 'Ese correo ya está registrado. Inicia sesión.'],
  [/signups? not allowed|signup is disabled/i, 'El registro público está desactivado. Pide a un administrador que cree tu usuario.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/invalid email|unable to validate email/i, 'El correo no es válido.'],
  [/failed to fetch|network/i, 'No se pudo conectar con Supabase. Revisa tu conexión y la URL del proyecto.']
]

export const traducirError = (e: { message?: string } | null) =>
  (ERRORES.find(([r]) => r.test(e?.message ?? '')) ?? [null, e?.message ?? 'Ocurrió un error inesperado.'])[1]

export type Respuesta = { error?: string; aviso?: string }

/** Lee el perfil y rol desde public.usuarios (el trigger fn_nuevo_usuario lo crea al registrarse). */
export async function obtenerPerfil(userId: string): Promise<{ perfil?: Perfil; error?: string }> {
  if (!supabase) return { error: 'Supabase no está configurado.' }
  const { data, error } = await supabase
    .from('usuarios')
    .select('id,nombres,email,activo,rol:roles(codigo,nombre)')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) {
    await supabase.auth.signOut()
    return { error: 'No se pudo cargar tu perfil de usuario. Verifica que el esquema SQL esté instalado en Supabase.' }
  }
  const p = data as unknown as Perfil
  if (!p.activo) {
    await supabase.auth.signOut()
    return { error: 'Tu usuario está desactivado. Contacta a un administrador.' }
  }
  return { perfil: p }
}

export async function login(email: string, password: string): Promise<{ userId?: string } & Respuesta> {
  if (!supabase) return { error: 'Supabase no está configurado.' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: traducirError(error) } : { userId: data.user.id }
}

export async function registro(nombres: string, email: string, password: string): Promise<{ userId?: string } & Respuesta> {
  if (!supabase) return { error: 'Supabase no está configurado.' }
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombres } } })
  if (error) return { error: traducirError(error) }
  if (data.user && data.user.identities && data.user.identities.length === 0) return { error: 'Ese correo ya está registrado. Inicia sesión.' }
  if (data.session && data.user) return { userId: data.user.id }
  return { aviso: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' }
}

export const logout = () => supabase?.auth.signOut()
