import { Pagination } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { PaginationMeta } from '../api/pagination'

import { paginationPages } from '../utils/pagination'

export default function KeshillaPagination({ pagination, onPageChange, isDisabled = false }: {
  pagination: PaginationMeta; onPageChange: (page: number) => void; isDisabled?: boolean
}) {
  const { t } = useTranslation()
  const { page, limit, total, totalPages } = pagination
  if (totalPages <= 1) return null
  const buttonClass = 'h-9 min-w-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 shadow-none hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-40'
  return (
    <Pagination aria-label={t('page.pages')} size="sm" className="my-4 flex w-full flex-col items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-none sm:flex-row">
      <Pagination.Summary aria-live="polite" className="text-sm text-slate-500">{t('page.range', { from: (page - 1) * limit + 1, to: Math.min(page * limit, total), total })}</Pagination.Summary>
      <Pagination.Content className="flex flex-wrap justify-center gap-1">
        <Pagination.Item><Pagination.Previous aria-label={t('page.prev')} className={buttonClass} isDisabled={isDisabled || page <= 1} onPress={() => onPageChange(page - 1)}><Pagination.PreviousIcon /><span className="hidden sm:inline">{t('page.back')}</span></Pagination.Previous></Pagination.Item>
        {paginationPages(page, totalPages).map((value, index) => <Pagination.Item key={`${value}-${index}`}>
          {value === 'ellipsis' ? <Pagination.Ellipsis /> : <Pagination.Link aria-label={t('page.pageN', { page: value })} isActive={value === page} isDisabled={isDisabled} onPress={() => onPageChange(value)} className={`${buttonClass} ${value === page ? '!border-blue-600 !bg-blue-600 !text-white' : ''}`}>{value}</Pagination.Link>}
        </Pagination.Item>)}
        <Pagination.Item><Pagination.Next aria-label={t('page.next')} className={buttonClass} isDisabled={isDisabled || page >= totalPages} onPress={() => onPageChange(page + 1)}><span className="hidden sm:inline">{t('page.forward')}</span><Pagination.NextIcon /></Pagination.Next></Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}
