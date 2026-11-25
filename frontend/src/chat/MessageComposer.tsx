import { useLayoutEffect, type KeyboardEvent, type RefObject } from 'react'
import { Button, Spinner, TextArea } from '@heroui/react'
import { SendHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const MESSAGE_MAX_LENGTH = 4000
const MAX_INPUT_HEIGHT = 168
const COUNTER_FROM = 300

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** Called on ArrowUp in an empty composer; returns true when it opened an edit. */
  onEditLast?: () => boolean
  sending: boolean
  disabled: boolean
  placeholder: string
  inputRef: RefObject<HTMLTextAreaElement | null>
}

export default function MessageComposer({ value, onChange, onSubmit, onEditLast, sending, disabled, placeholder, inputRef }: Props) {
  const { t } = useTranslation()
  const remaining = MESSAGE_MAX_LENGTH - value.length
  const canSend = !disabled && !sending && value.trim().length > 0

  // Grow with the text up to a comfortable maximum, then scroll inside the field.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`
    input.style.overflowY = input.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [value, inputRef])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowUp' && !value && onEditLast?.()) {
      event.preventDefault()
      return
    }
    // Touch keyboards keep Enter for new lines; the send button sends.
    if (event.key === 'Enter' && !event.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
      event.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <div className={`msg-composer${disabled ? ' is-disabled' : ''}`}>
      <form
        className="msg-composer-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSend) onSubmit()
        }}
      >
        <div className="msg-composer-field">
          <TextArea
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={t('feedback.message')}
            maxLength={MESSAGE_MAX_LENGTH}
            disabled={disabled}
            enterKeyHint="send"
            className="msg-composer-input"
          />
          {remaining <= COUNTER_FROM ? (
            <span className={`msg-composer-count${remaining <= 50 ? ' is-low' : ''}`} aria-live="polite">
              {t('inbox.charsLeft', { count: remaining })}
            </span>
          ) : null}
        </div>
        <Button
          type="submit"
          isIconOnly
          variant="primary"
          className={`msg-send${canSend ? ' is-ready' : ''}`}
          isDisabled={!canSend}
          aria-label={t('feedback.send')}
        >
          {sending ? <Spinner size="sm" color="current" /> : <SendHorizontal size={18} aria-hidden />}
        </Button>
      </form>
      {!disabled ? <p className="msg-composer-hint" aria-hidden>{t('inbox.composerHint')}</p> : null}
    </div>
  )
}
