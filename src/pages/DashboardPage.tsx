import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDatos } from '../hooks/useDatos'
import { useAuth } from '../hooks/useAuth'
import { ALMACENES, nombreTercero, stockTotal } from '../services/datos'
import { facturarOrdenVenta } from '../services/operaciones'
import { fechaCorta, hoyMenos, moneda, sumar, totalConIgv } from '../utils/format'
import Icon from '../components/Icon'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import DocumentoModal from '../components/DocumentoModal'

export default function DashboardPage() {
  const { datos: d, ejecutar } = useDatos()
  const { perfil } = useAuth()
  const ir = useNavigate()
  const [R, setR] = useState(7)
  const [ver, setVer] = useState({ v: true, c: true })
  const [hover, setHover] = useState<number | null>(null)
  // formulario de nueva orden abierto desde el panel (nueva venta, nueva compra o reposición)
  const [doc, setDoc] = useState<{ tipo: 'OC' | 'OV'; producto?: string } | null>(null)

  const ventaDia = (n: number) => sumar(d.comprobantes.filter(f => f.fecha === hoyMenos(n)), f => f.total)
  const compraDia = (n: number) => sumar(d.ordenesCompra.filter(o => o.estado === 'Recibida' && (o.fechaRecepcion ?? o.fecha) === hoyMenos(n)), o => totalConIgv(o.lineas))
  const actual = Array.from({ length: R }, (_, i) => R - 1 - i)
  const previo = actual.map(n => n + R)
  const ventas = sumar(actual, ventaDia), compras = sumar(actual, compraDia)
  const variacion = (actual: number, anterior: number) => (anterior > 0 ? (actual / anterior - 1) * 100 : null)
  const dVentas = variacion(ventas, sumar(previo, ventaDia)), dCompras = variacion(compras, sumar(previo, compraDia))
  const pendVenta = d.ordenesVenta.filter(o => o.estado === 'Pendiente').length
  const pendCompra = d.ordenesCompra.filter(o => o.estado === 'Pendiente').length
  const bajos = d.productos.filter(p => stockTotal(p) < p.minimo).sort((a, b) => stockTotal(a) / a.minimo - stockTotal(b) / b.minimo)

  const paso = 550 / (R - 1)
  const pts = actual.map((n, i) => ({ x: 40 + i * paso, v: ventaDia(n), c: compraDia(n), d: fechaCorta(hoyMenos(n)).slice(0, 5) }))
  const mx = Math.max(ver.v ? Math.max(...pts.map(p => p.v)) : 0, ver.c ? Math.max(...pts.map(p => p.c)) : 0, 1) * 1.1
  const Y = (v: number) => 196 - (v / mx) * 180
  const curva = (k: 'v' | 'c') => pts.map((p, i) => i
    ? `C${(pts[i - 1].x + p.x) / 2},${Y(pts[i - 1][k])} ${(pts[i - 1].x + p.x) / 2},${Y(p[k])} ${p.x},${Y(p[k])}`
    : `M${p.x},${Y(p[k])}`).join(' ')

  const hr = new Date().getHours()
  const saludo = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'
  const delta = (v: number | null) => v === null ? <span className="mut">Sin período anterior para comparar</span> : <><span className={v >= 0 ? 'up' : 'dn'}>{v >= 0 ? '▲ +' : '▼ −'}{Math.abs(v).toFixed(1)}%</span> <span className="mut">vs. período anterior</span></>
  const kpi = (ruta: string, titulo: string, valor: string, sub: React.ReactNode, ic: string) => (
    <button className="kc" onClick={() => ir(ruta)}><span className="kt"><span className="mut">{titulo}</span><i><Icon nombre={ic} /></i></span><b>{valor}</b><small>{sub}</small></button>
  )
  const hp = hover !== null ? pts[hover] : null

  return (
    <>
      <PageHeader
        titulo={`${saludo}, ${(perfil?.nombres ?? '').split(' ')[0]}`}
        descripcion="Este es el resumen de tu negocio."
        acciones={<>
          <span className="seg">{[7, 14, 30].map(r => <button key={r} className={r === R ? 'on' : ''} onClick={() => setR(r)}>{r} días</button>)}</span>{' '}
          <button className="pri" onClick={() => setDoc({ tipo: 'OV' })}>+ Nueva venta</button>
        </>}
      />
      <div className="kg">
        {kpi('/facturacion', 'Ventas totales', moneda(ventas), delta(dVentas), 'cta')}
        {kpi('/compras', 'Compras totales', moneda(compras), delta(dCompras), 'oc')}
        {kpi('/stock', 'Productos en stock', sumar(d.productos, stockTotal).toLocaleString('es-PE'), `${new Set(d.productos.map(p => p.categoria)).size} categorías en ${ALMACENES.length} almacén${ALMACENES.length === 1 ? '' : 'es'}`, 'stk')}
        {kpi('/ventas', 'Órdenes pendientes', String(pendVenta + pendCompra), `${pendVenta} por facturar · ${pendCompra} por recibir`, 'cot')}
      </div>

      <div className="g2d">
        <div className="c pad">
          <div className="top">
            <div><b>Ventas y compras</b><div className="mut">Últimos {R} días</div></div>
            <span className="lgd">
              <button className={ver.v ? '' : 'off'} onClick={() => setVer({ ...ver, v: !ver.v })}><u style={{ background: 'var(--ac)' }} />Ventas</button>
              <button className={ver.c ? '' : 'off'} onClick={() => setVer({ ...ver, c: !ver.c })}><u style={{ background: '#2dd4bf' }} />Compras</button>
            </span>
          </div>
          <svg viewBox="0 0 620 215" width="100%" style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
            {[0, 1, 2, 3, 4].map(t => {
              const v = (mx * t) / 4
              return <g key={t}><line x1="40" x2="600" y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x="34" y={Y(v) + 3} textAnchor="end" fontSize="10" fill="var(--mut)">{v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text></g>
            })}
            {ver.v && <><path d={`${curva('v')} L${pts[R - 1].x},196 L40,196Z`} fill="var(--ac)" opacity=".13" /><path d={curva('v')} fill="none" stroke="var(--ac)" strokeWidth="2.4" /></>}
            {ver.c && <path d={curva('c')} fill="none" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="5 4" />}
            {hp && <line x1={hp.x} x2={hp.x} y1="10" y2="196" stroke="var(--mut)" strokeDasharray="3 3" />}
            {pts.map((p, i) => (
              <g key={i}>
                {i % Math.ceil(R / 7) === 0 && <text x={p.x} y="212" textAnchor="middle" fontSize="10" fill="var(--mut)">{p.d}</text>}
                <rect className="hz" x={p.x - paso / 2} y="10" width={paso} height="186" fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            ))}
          </svg>
          <div className="cap">{hp ? <><b>{hp.d}</b> · Ventas <b>{moneda(hp.v)}</b> · Compras <b>{moneda(hp.c)}</b></> : 'Pasa el cursor sobre el gráfico para ver el detalle de cada día.'}</div>
          <div className="pg"><span>Total ventas <b>{moneda(ventas)}</b></span><span>Total compras <b>{moneda(compras)}</b></span><span>{delta(dVentas)}</span></div>
        </div>

        <div className="c pad">
          <div className="top"><b>Alertas de inventario</b><span className={'b ' + (bajos.length ? 'warn' : 'ok')}>{bajos.length} alertas</span></div>
          <p className="mut" style={{ margin: '0 0 4px' }}>Productos que necesitan atención</p>
          {bajos.slice(0, 4).map(p => (
            <div className="ai" key={p.id}>
              <i><Icon nombre="ing" /></i>
              <div><b>{p.nombre}</b><small>{p.id} · Mínimo: {p.minimo} und.</small></div>
              <span className="b bad">{stockTotal(p)} und.</span>
              <button onClick={() => setDoc({ tipo: 'OC', producto: p.id })}>Reponer</button>
            </div>
          ))}
          {!bajos.length && <p className="mut">✓ Todos los productos están sobre su mínimo.</p>}
          <button className="qi" onClick={() => ir('/stock')}><span>Revisa la reposición de estos productos</span><b>›</b></button>
        </div>
      </div>

      <div className="d2">
        <div>
          <div className="top"><h2 style={{ margin: '0 0 8px' }}>Órdenes de venta recientes</h2><Link to="/ventas"><button>Ver todas ↗</button></Link></div>
          <DataTable
            cabecera={false}
            filas={d.ordenesVenta}
            texto={x => x.id + nombreTercero(d, x.cliente)}
            estado={x => x.estado}
            fecha={x => x.fecha}
            almacen={x => x.almacen}
            almacenes={ALMACENES}
            columnas={[
              { titulo: 'N.º', celda: x => <code>{x.id}</code>, orden: x => x.id },
              { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
              { titulo: 'Cliente', celda: x => nombreTercero(d, x.cliente), orden: x => nombreTercero(d, x.cliente) },
              { titulo: 'Almacén', celda: x => x.almacen },
              { titulo: 'Pago', celda: x => x.pago },
              { titulo: 'Importe', celda: x => moneda(totalConIgv(x.lineas)), orden: x => totalConIgv(x.lineas) },
              { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
              { titulo: '', celda: x => x.estado === 'Pendiente' ? <button className="pri" onClick={() => ejecutar(c => facturarOrdenVenta(c, x.id))}>Facturar</button> : (x.comprobante ?? '') }
            ]}
          />
        </div>
        <div className="c pad">
          <b>Accesos rápidos</b>
          <p className="mut" style={{ margin: '0 0 6px' }}>Operaciones frecuentes</p>
          <div className="qa">
            {([['plus', 'Nueva orden de venta', () => setDoc({ tipo: 'OV' })], ['oc', 'Nueva orden de compra', () => setDoc({ tipo: 'OC' })], ['fac', 'Emitir comprobante', () => ir('/facturacion')], ['ing', 'Registrar ingreso', () => ir('/recepcion')]] as const).map(q => (
              <button className="qi" key={q[1]} onClick={q[2]}><i><Icon nombre={q[0]} /></i><span>{q[1]}</span><b>›</b></button>
            ))}
          </div>
        </div>
      </div>
      {doc && <DocumentoModal tipo={doc.tipo} productoInicial={doc.producto} onClose={() => setDoc(null)} />}
    </>
  )
}
