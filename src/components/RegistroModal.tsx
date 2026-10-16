import { useState } from 'react'
import { useDatos } from '../hooks/useDatos'
import { crearRegistro, type TipoCatalogo } from '../services/operaciones'
import Modal from './Modal'

const CAMPOS: Record<TipoCatalogo, { clave: string; etiqueta: string; opciones?: string[]; numero?: boolean }[]> = {
  cliente: [
    { clave: 'nombre', etiqueta: 'Razón social' }, { clave: 'ruc', etiqueta: 'RUC' }, { clave: 'segmento', etiqueta: 'Segmento', opciones: ['Distribuidor', 'Mayorista', 'Minorista'] },
    { clave: 'contacto', etiqueta: 'Contacto' }, { clave: 'telefono', etiqueta: 'Teléfono' }, { clave: 'correo', etiqueta: 'Correo' }, { clave: 'direccion', etiqueta: 'Dirección' },
    { clave: 'condicion', etiqueta: 'Condición de pago', opciones: ['Según segmento', 'Contado', 'Crédito 30 días', 'Crédito 60 días'] }, { clave: 'limite', etiqueta: 'Línea de crédito (S/) · vacío = según segmento', numero: true }
  ],
  proveedor: [
    { clave: 'nombre', etiqueta: 'Razón social' }, { clave: 'ruc', etiqueta: 'RUC' }, { clave: 'contacto', etiqueta: 'Contacto' }, { clave: 'telefono', etiqueta: 'Teléfono' },
    { clave: 'correo', etiqueta: 'Correo' }, { clave: 'direccion', etiqueta: 'Dirección' }, { clave: 'condicion', etiqueta: 'Condición de pago', opciones: ['Contado', 'Crédito 30 días', 'Crédito 60 días'] }
  ],
  producto: [
    { clave: 'nombre', etiqueta: 'Producto' }, { clave: 'categoria', etiqueta: 'Categoría' }, { clave: 'costo', etiqueta: 'Costo (S/)', numero: true },
    { clave: 'precio', etiqueta: 'Precio de venta (S/)', numero: true }, { clave: 'minimo', etiqueta: 'Stock mínimo (und.)', numero: true }
  ]
}

/** Alta rápida de clientes, proveedores y productos. */
export default function RegistroModal({ tipo, onClose }: { tipo: TipoCatalogo; onClose: () => void }) {
  const { ejecutar } = useDatos()
  const campos = CAMPOS[tipo]
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(campos.map(c => [c.clave, c.opciones?.[0] ?? ''])))
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    setGuardando(true)
    const bien = await ejecutar(d => crearRegistro(d, tipo, v))
    setGuardando(false)
    if (bien) onClose()
  }
  return (
    <Modal titulo={'Nuevo ' + tipo} onClose={onClose} pie={<button className="pri" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar'}</button>}>
      {campos.map(c => (
        <label key={c.clave}>{c.etiqueta}
          {c.opciones
            ? <select value={v[c.clave]} onChange={e => setV({ ...v, [c.clave]: e.target.value })}>{c.opciones.map(o => <option key={o}>{o}</option>)}</select>
            : <input type={c.numero ? 'number' : 'text'} value={v[c.clave]} onChange={e => setV({ ...v, [c.clave]: e.target.value })} />}
        </label>
      ))}
    </Modal>
  )
}
