import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Drawer } from 'vaul'
import './BottomSheet.css'

/*
 * The one bottom sheet of the app (Vaul): swipe down, tap the backdrop or press Escape to close,
 * focus is trapped and the page behind does not scroll.
 *
 *   <BottomSheet open={open} onOpenChange={setOpen}>
 *     <BottomSheetHeader title="Filters" />
 *     <BottomSheetBody>…</BottomSheetBody>
 *     <BottomSheetFooter>…</BottomSheetFooter>
 *   </BottomSheet>
 *
 * Sheets with their own header still need a <BottomSheetTitle> (it can be visually hidden) for screen readers.
 */

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ')

type BottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
  /** false blocks swipe, backdrop tap and Escape — e.g. while a form is being sent. */
  dismissible?: boolean
  /** Keep text fields above the on-screen keyboard (on by default). */
  repositionInputs?: boolean
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  className,
  dismissible = true,
  repositionInputs = true,
}: BottomSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      repositionInputs={repositionInputs}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="kk-sheet-overlay" />
        <Drawer.Content className={cx('kk-sheet', className)} aria-describedby={undefined}>
          <div className="kk-sheet-handle" aria-hidden />
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export const BottomSheetTitle = Drawer.Title

export function BottomSheetHeader({
  title,
  kicker,
  children,
  closeDisabled = false,
  className,
}: {
  title: ReactNode
  /** Small label above the title. */
  kicker?: ReactNode
  /** Extra lines under the title, e.g. a short lead. */
  children?: ReactNode
  closeDisabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cx('kk-sheet-head', className)}>
      <div className="kk-sheet-head-copy">
        {kicker ? <p className="kk-sheet-kicker">{kicker}</p> : null}
        <Drawer.Title className="kk-sheet-title">{title}</Drawer.Title>
        {children}
      </div>
      <Drawer.Close className="kk-sheet-close" aria-label={t('nav.close')} disabled={closeDisabled}>
        <X size={18} aria-hidden />
      </Drawer.Close>
    </div>
  )
}

export function BottomSheetBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('kk-sheet-body', className)} {...props} />
}

export function BottomSheetFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('kk-sheet-foot', className)} {...props} />
}
