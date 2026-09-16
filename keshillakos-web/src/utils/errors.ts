import axios from 'axios'

export function getErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message
    if (typeof msg === 'string' && msg.trim()) return msg
    if (!err.response) return 'Nuk u lidh me serverin. Sigurohu që API është ndezur.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Diçka shkoi keq'
}
