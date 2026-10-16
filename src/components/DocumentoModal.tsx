import { useState } from 'react'
import type { Linea, Pago, Producto, Tercero } from '../types'
import { useDatos } from '../hooks/useDatos'
import { ALMACENES, COMPROBANTES, CONDICIONES_PAGO, SUCURSALES, nombreProducto, productoPorId, stockTotal } from '../services/datos'
import { crearDocumento } from '../services/operaciones'
import { hoyMenos, moneda, subtotal } from '../utils/format'
import Icon from './Icon'
import Badge from './Badge'
import FichaTercero from './FichaTercero'
import SelectorModal from './SelectorModal'
import type { Columna } from './DataTable'

interface Props { tipo: 'OC' | 'COT' | 'OV'; productoInicial?: string; onClose: () => void }
const TITULO = { OC: 'Nueva orden de compra', COT: 'Nueva cotización', OV: 'Nueva orden de venta' }
const SEGMENTOS = ['Distribuidor', 'Mayorista', 'Minorista']
const iniciales = (n: string) => n.split(' ').slice(0, 2).map(w => w[0]).join('')

type FilaProducto = Producto & { precioDoc: number; stockSel: number }

/** Formulario único para crear órdenes de compra, cotizaciones y órdenes de venta. */
export default function DocumentoModal({ tipo, productoInicial, onClose }: Props) {
  const { datos: d, ejecutar } = useDatos()
  const esCompra = tipo === 'OC'
  const quien = esCompra ? 'proveedor' : 'cliente'
  const terceros = (esCompra ? d.proveedores : d.clientes).filter(x => x.activo)

  const [idTercero, setIdTercero] = useState('')
  const [selector, setSelector] = useState<'tercero' | 'producto' | null>(null)
  const [sucursal, setSucursal] = useState(SUCURSALES[0] ?? '')
  const [almacen, setAlmacen] = useState(ALMACENES[0] ?? '')
  const [fecha, setFecha] = useState(hoyMenos(0))
  const [condicion, setCondicion] = useState(CONDICIONES_PAGO[0])
  const [cuotas, setCuotas] = useState(0)
  const [vigencia, setVigencia] = useState(15)
  const [comprobante, setComprobante] = useState<'Factura' | 'Boleta'>('Factura')
  const [descuento, setDescuento] = useState(0)
  const [obs, setObs] = useState('')
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const p = productoInicial ? productoPorId(d, productoInicial) : undefined
    return p ? [{ producto: p.id, cantidad: Math.max(1, p.minimo * 2 - stockTotal(p)), precio: p.costo }] : []
  })

  const pago: Pago = condicion === 'Contado' ? 'Contado' : 'Crédito'
  const dias = +(condicion.match(/\d+/)?.[0] ?? 30)

  const agregar = (p: Producto) => setLineas(ls => ls.some(l => l.producto === p.id)
    ? ls.map(l => (l.producto === p.id ? { ...l, cantidad: l.cantidad + 1 } : l))
    : [...ls, { producto: p.id, cantidad: 1, precio: esCompra ? p.costo : p.precio }])
  const cambiar = (i: number, campo: 'cantidad' | 'precio', v: number) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))

  const sb = subtotal(lineas)
  const desc = Math.min(Math.max(descuento || 0, 0), sb)
  const base = sb - desc
  const sel = d.clientes.concat(d.proveedores).find(x => x.id === idTercero)

  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    setGuardando(true)
    const bien = await ejecutar(c => crearDocumento(c, {
      tipo, fecha, tercero: idTercero, almacen, pago: tipo === 'COT' ? 'Contado' : pago, vigencia, comprobante,
      lineas, descuento: descuento || 0, obs, sucursal, dias, cuotas: cuotas || 0
    }))
    setGuardando(false)
    if (bien) onClose()
  }

  // ---- selectores (ventanas de búsqueda) ----
  const ai = ALMACENES.indexOf(almacen)
  const filasProducto: FilaProducto[] = d.productos.filter(p => p.activo).map(p => ({ ...p, precioDoc: esCompra ? p.costo : p.precio, stockSel: tipo === 'COT' ? stockTotal(p) : p.stock[ai] }))
  const columnasProducto: Columna<FilaProducto>[] = [
    { titulo: 'Código', celda: x => <code>{x.id}</code> },
    { titulo: 'Producto', celda: x => <>{x.nombre}{lineas.some(l => l.producto === x.id) && <> <span className="b ok">en la orden</span></>}<br /><small className="mut">{x.categoria}</small></> },
    { titulo: esCompra ? 'Costo unit.' : 'Precio unit.', celda: x => moneda(x.precioDoc) },
    { titulo: 'Stock · UND', celda: x => <b className={x.stockSel < 20 ? 'dn' : ''}>{x.stockSel}</b> },
    { titulo: 'Estado', celda: x => <Badge estado={x.stockSel < 20 ? 'Stock bajo' : 'Activo'} /> }
  ]
  const columnasTercero: Columna<Tercero>[] = [
    { titulo: 'Código', celda: x => <code>{x.id}</code> },
    { titulo: 'Razón social', celda: x => <><span className="av">{iniciales(x.nombre)}</span>{x.nombre}</> },
    { titulo: 'RUC', celda: x => x.ruc },
    { titulo: 'Segmento', celda: x => <span className="b">{x.segmento}</span> },
    { titulo: 'Estado', celda: x => <Badge estado={x.activo ? 'Activo' : 'Inactivo'} /> }
  ]

  return (
    <div className="ov on">
      <div className="md big">
        <div className="mh">
          <i><Icon nombre={esCompra ? 'ing' : tipo === 'COT' ? 'cot' : 'ov'} /></i>
          <div><h3>{TITULO[tipo]}</h3><small className="mut">Completa los datos del documento y registra.</small></div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="dg">
          <div className="dl">
            <h4 className="sec"><i>1</i>{esCompra ? 'Proveedor' : 'Cliente'}</h4>
            {sel
              ? <>
                  <FichaTercero t={sel} />
                  <button className="wide cambiar" onClick={() => setSelector('tercero')}><Icon nombre="plus" /> Cambiar {quien}</button>
                </>
              : <button className="ph pick" onClick={() => setSelector('tercero')}>
                  <Icon nombre={esCompra ? 'ing' : 'cta'} />
                  <span><b>Seleccionar {quien}</b><br /><small>para cargar sus datos aquí</small></span>
                </button>}

            <h4 className="sec"><i>2</i>Productos{tipo !== 'COT' && <> · <span>Almacén {almacen.toLowerCase()}</span></>}</h4>
            {lineas.length > 0 && <div className="ln hd"><span>Producto</span><span>Cant.</span><span>Precio unit.</span><span>Subtotal</span><span></span></div>}
            {lineas.map((l, i) => (
              <div className="ln" key={l.producto}>
                <span className="lp"><b>{nombreProducto(d, l.producto)}</b><small className="mut">{l.producto}</small></span>
                <input type="number" min={1} value={l.cantidad} onChange={e => cambiar(i, 'cantidad', +e.target.value)} />
                <input type="number" step=".01" value={l.precio} onChange={e => cambiar(i, 'precio', +e.target.value)} />
                <span className="ls">{moneda(l.cantidad * l.precio)}</span>
                <button onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="add" onClick={() => setSelector('producto')}>+ Agregar producto</button>

            <h4 className="sec"><i>3</i>Datos del documento</h4>
            <div className="g3">
              <label>Sucursal<select value={sucursal} onChange={e => setSucursal(e.target.value)}>{SUCURSALES.map(s => <option key={s}>{s}</option>)}</select></label>
              {tipo !== 'COT'
                ? <label>{esCompra ? 'Almacén destino' : 'Almacén despacho'}<select value={almacen} onChange={e => setAlmacen(e.target.value)}>{ALMACENES.map((a, i) => <option key={a} value={a}>ALM-0{i + 1} · Almacén {a.toLowerCase()}</option>)}</select></label>
                : <label>Vigencia<select value={vigencia} onChange={e => setVigencia(+e.target.value)}>{[7, 15, 30].map(v => <option key={v} value={v}>{v} días</option>)}</select></label>}
              <label>Fecha de emisión<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
              <label>Moneda<select disabled><option>Soles (PEN)</option></select></label>
              {tipo !== 'COT' && <label>Forma de pago<select value={condicion} onChange={e => setCondicion(e.target.value)}>{CONDICIONES_PAGO.map(c => <option key={c}>{c}</option>)}</select></label>}
              {tipo === 'OV' && <>
                <label>N.º de cuotas<input type="number" min={0} value={cuotas} onChange={e => setCuotas(+e.target.value)} /></label>
                <label>Comprobante<select value={comprobante} onChange={e => setComprobante(e.target.value as 'Factura' | 'Boleta')}>{COMPROBANTES.map(c => <option key={c.tipo} value={c.tipo}>{c.etiqueta}</option>)}</select></label>
              </>}
            </div>

            <h4 className="sec"><i>4</i>Observaciones</h4>
            <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Condiciones de entrega, referencias…" />
          </div>

          <div className="dr">
            <h4 className="sec">Resumen</h4>
            <div className="cond">
              <b>Condiciones económicas</b>
              <label>Descuento global (S/)<input type="number" min={0} step=".01" value={descuento} onChange={e => setDescuento(+e.target.value)} /></label>
              <small className="mut">El descuento se reparte entre los productos y el total se recalcula con IGV.</small>
            </div>
            <div className="tots">
              <div><span>Subtotal</span><span>{moneda(sb)}</span></div>
              <div><span>Descuento</span><span>− {moneda(desc)}</span></div>
              <div><span>Op. gravada</span><span>{moneda(base)}</span></div>
              <div><span>IGV (18%)</span><span>{moneda(base * 0.18)}</span></div>
              <div className="tt"><b>Total a pagar</b><b>{moneda(base * 1.18)}</b></div>
            </div>
            <div className="ft">
              <button onClick={onClose}>Cancelar</button>
              <button className="pri" disabled={guardando} onClick={() => void guardar()}><Icon nombre="check" /> {tipo === 'COT' ? 'Registrar cotización' : 'Registrar orden'}</button>
            </div>
          </div>
        </div>
      </div>

      {selector === 'tercero' && (
        <SelectorModal<Tercero>
          titulo={'Seleccionar ' + quien}
          subtitulo="Elige un registro de tu catálogo"
          filas={terceros}
          columnas={columnasTercero}
          texto={x => x.id + x.nombre + x.ruc}
          chips={esCompra ? undefined : SEGMENTOS}
          chip={x => x.segmento}
          onElegir={x => { setIdTercero(x.id); setSelector(null) }}
          onClose={() => setSelector(null)}
        />
      )}
      {selector === 'producto' && (
        <SelectorModal<FilaProducto>
          titulo="Agregar producto"
          subtitulo="Precios sin IGV · el stock corresponde al almacén elegido"
          filas={filasProducto}
          columnas={columnasProducto}
          texto={x => x.id + x.nombre + x.categoria}
          onElegir={x => { agregar(x); setSelector(null) }}
          onClose={() => setSelector(null)}
        />
      )}
    </div>
  )
}
