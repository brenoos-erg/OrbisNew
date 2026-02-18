'use client'

export function TableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-3 py-3">
              <div className="h-3 rounded bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}