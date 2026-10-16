import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import Badge from '../../components/Badge'

interface Fila { id: string; email: string | null; nombres: string; activo: boolean; rol_id: number }
interface Rol { id: number; codigo: string; nombre: string }

/** Administración de usuarios: lee y edita public.usuarios (solo el rol admin puede modificar, por RLS). */
export default function UsuariosPage() {
  const { perfil } = useAuth()
  const avisar = useToast()
  const [usuarios, setUsuarios] = useState<Fila[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!supabase) return
    const [u, r] = await Promise.all([
      supabase.from('usuarios').select('id,email,nombres,activo,rol_id').order('created_at'),
      supabase.from('roles').select('id,codigo,nombre').order('id')
    ])
    if (u.error) avisar(u.error.message, true)
    setUsuarios((u.data ?? []) as Fila[])
    setRoles((r.data ?? []) as Rol[])
    setCargando(false)
  }, [avisar])

  useEffect(() => { void cargar() }, [cargar])

  const actualizar = async (id: string, cambios: Partial<Pick<Fila, 'rol_id' | 'activo'>>) => {
    const { error } = await supabase!.from('usuarios').update(cambios).eq('id', id)
    if (error) return avisar(error.message, true)
    avisar('Usuario actualizado')
    void cargar()
  }

  return (
    <>
      <PageHeader titulo="Usuarios" descripcion="Asigna el rol de cada persona y activa o desactiva su acceso." />
      <div className="c"><div className="sc">
        <table>
          <thead><tr><th>Nombres</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {usuarios.map(u => {
              const yo = u.id === perfil?.id
              return (
                <tr key={u.id}>
                  <td>{u.nombres}{yo && <> <span className="b">tú</span></>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.rol_id} disabled={yo} onChange={e => void actualizar(u.id, { rol_id: +e.target.value })}>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </td>
                  <td><Badge estado={u.activo ? 'Activo' : 'Inactivo'} /></td>
                  <td>{!yo && <button onClick={() => void actualizar(u.id, { activo: !u.activo })}>{u.activo ? 'Desactivar' : 'Activar'}</button>}</td>
                </tr>
              )
            })}
            {!usuarios.length && <tr><td colSpan={5} className="mut">{cargando ? 'Cargando…' : 'Sin usuarios'}</td></tr>}
          </tbody>
        </table>
      </div></div>
    </>
  )
}
