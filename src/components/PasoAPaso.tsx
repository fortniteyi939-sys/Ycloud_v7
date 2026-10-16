import { Link } from 'react-router-dom'
import { GUIA } from '../utils/guia'

export default function PasoAPaso({ clave }: { clave: string }) {
  const g = GUIA[clave]
  if (!g) return null
  return (
    <div className="tip">
      <span><b>{g.paso}</b> · {g.texto}</span>
      <Link to={g.ruta}><button>{g.boton} →</button></Link>
    </div>
  )
}
