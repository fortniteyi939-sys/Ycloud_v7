import { useEffect, useState } from 'react'

/**
 * Convierte un PDF generado en memoria en una URL (blob:) usable en <iframe>, <a href> y descargas.
 * La URL se crea y se libera DENTRO del efecto: así funciona con React.StrictMode, que monta,
 * desmonta y vuelve a montar los efectos en desarrollo (liberar una URL creada en useMemo la dejaba muerta).
 * Devuelve '' hasta que el PDF está listo.
 */
export function usePdfUrl(crear: () => Blob, deps: unknown[]): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(crear())
    setUrl(u)
    return () => URL.revokeObjectURL(u)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return url
}
