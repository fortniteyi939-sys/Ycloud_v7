/**
 * Generador mínimo de PDF (A4, una página, Helvetica) sin dependencias externas.
 * Origen de coordenadas: esquina inferior izquierda, en puntos (595 × 842).
 */
export type Color = [number, number, number]

const REEMPLAZOS: Record<string, string> = { '—': '-', '–': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '✓': '' }

// El PDF se escribe en Latin-1 (1 carácter = 1 byte): lo demás se sustituye y se escapan ( ) \
const limpiar = (s: string) =>
  s.replace(/[—–“”‘’…✓]/g, c => REEMPLAZOS[c])
    .replace(/[^\x00-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

const n = (v: number) => +v.toFixed(2)

export class Pdf {
  private ops: string[] = []

  rect(x: number, y: number, w: number, h: number, color: Color) {
    this.ops.push(`${color.join(' ')} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`)
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Color = [0.85, 0.85, 0.9]) {
    this.ops.push(`${color.join(' ')} RG 0.8 w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`)
  }

  text(s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: Color } = {}) {
    const { size = 11, bold = false, color = [0.1, 0.1, 0.15] } = o
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${n(x)} ${n(y)} Td (${limpiar(s)}) Tj ET`)
  }

  blob(): Blob {
    const contenido = this.ops.join('\n')
    const objetos = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ]
    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    objetos.forEach((o, i) => {
      offsets.push(out.length)
      out += `${i + 1} 0 obj\n${o}\nendobj\n`
    })
    const xref = out.length
    out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
    out += offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')
    out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`

    const bytes = new Uint8Array(out.length)
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
    return new Blob([bytes], { type: 'application/pdf' })
  }
}
