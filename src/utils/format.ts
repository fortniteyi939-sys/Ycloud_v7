import type { Linea } from '../types'

export const IGV = 0.18
export const moneda = (n: number) => 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Fecha de negocio en hora de Lima (igual que public.hoy() en la base de datos)
export const hoyMenos = (dias: number) => new Date(Date.now() - dias * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
export const fechaCorta = (iso: string) => iso.split('-').reverse().join('/')
export const rellenar = (n: number, largo = 4) => String(n).padStart(largo, '0')
export const sumar = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)
export const subtotal = (l: Linea[]) => sumar(l, x => x.cantidad * x.precio)
export const totalConIgv = (l: Linea[]) => subtotal(l) * (1 + IGV)

export function exportarCsv(archivo: string, encabezados: string[], filas: (string | number)[][]) {
  const t = (s: string | number) => '"' + String(s).replace(/"/g, '""') + '"'
  const texto = [encabezados, ...filas].map(f => f.map(t).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8' }))
  a.download = archivo + '.csv'
  a.click()
}
