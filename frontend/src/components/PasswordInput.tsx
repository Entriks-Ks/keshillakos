import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()

  return (
    <span className="password-control">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? t('auth.hide') : t('auth.show')}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
      </button>
    </span>
  )
}
