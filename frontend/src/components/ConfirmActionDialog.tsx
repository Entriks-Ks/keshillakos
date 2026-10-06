import { AlertDialog, Button } from '@heroui/react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
}

export default function ConfirmActionDialog({ isOpen, onClose, onConfirm, title, description, confirmLabel, pending = false }: Props) {
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <AlertDialog.Backdrop isDismissable={false} isKeyboardDismissDisabled>
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header><AlertDialog.Heading>{title}</AlertDialog.Heading></AlertDialog.Header>
            <AlertDialog.Body><p>{description}</p></AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="outline" isDisabled={pending} onPress={onClose}>Anulo</Button>
              <Button variant="danger" isPending={pending} isDisabled={pending} onPress={onConfirm}>{confirmLabel}</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
