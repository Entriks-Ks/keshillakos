export function paginationPages(page: number, totalPages: number): Array<number | 'ellipsis'> {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b)
  const result: Array<number | 'ellipsis'> = []
  pages.forEach((value, index) => {
    const previous = pages[index - 1]
    if (previous && value - previous === 2) result.push(previous + 1)
    else if (previous && value - previous > 2) result.push('ellipsis')
    result.push(value)
  })
  return result
}
