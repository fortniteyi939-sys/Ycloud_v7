const RUTAS: Record<string, string> = {
  dash: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  oc: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 20h.01M18 20h.01',
  ing: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  cot: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h6',
  ov: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3',
  fac: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cta: 'M3 7h16a2 2 0 012 2v10H5a2 2 0 01-2-2zM3 7l14-3v3M16 13h3',
  kdx: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  stk: 'M12 3l4 2v4l-4 2-4-2V5zM6 13l4 2v4l-4 2-4-2v-4zM18 13l4 2v4l-4 2-4-2v-4z',
  rep: 'M4 19h16M7 16V9m5 7V5m5 11v-4',
  usr: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  mant: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  mi: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z'
}

export default function Icon({ nombre, tam = 18 }: { nombre: string; tam?: number }) {
  return (
    <svg className={nombre === 'mi' ? 'cv' : ''} viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={RUTAS[nombre]} />
    </svg>
  )
}
