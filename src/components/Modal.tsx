import type { ReactNode } from 'react'

interface Props { titulo: string; onClose: () => void; children: ReactNode; pie?: ReactNode }

export default function Modal({ titulo, onClose, children, pie }: Props) {
  return (
    <div className="ov on" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="md">
        <h3>{titulo}</h3>
        {children}
        <div className="ft">
          <button onClick={onClose}>{pie ? 'Cancelar' : 'Cerrar'}</button>
          {pie}
        </div>
      </div>
    </div>
  )
}
