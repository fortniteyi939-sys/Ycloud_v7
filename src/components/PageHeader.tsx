import type { ReactNode } from 'react'

export default function PageHeader({ titulo, descripcion, acciones }: { titulo: string; descripcion: string; acciones?: ReactNode }) {
  return (
    <div className="hd">
      <div><h1>{titulo}</h1><p className="mut">{descripcion}</p></div>
      <div>{acciones}</div>
    </div>
  )
}
