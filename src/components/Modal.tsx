import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ children, labelledBy, busy, onClose }: { children: ReactNode; labelledBy: string; busy: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>{children}</dialog>
}
