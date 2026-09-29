import { Button } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './BackButton.css'

type Props = {
  fallback: string
}

function hasAppHistory() {
  const state = window.history.state as { idx?: number } | null
  return typeof state?.idx === 'number' && state.idx > 0
}

export default function BackButton({ fallback }: Props) {
  const navigate = useNavigate()

  function goBack() {
    if (hasAppHistory()) {
      navigate(-1)
      return
    }
    navigate(fallback)
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="kk-back-btn" onPress={goBack}>
      <ArrowLeft size={16} aria-hidden />
      Kthehu
    </Button>
  )
}
