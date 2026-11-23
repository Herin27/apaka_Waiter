import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  page = 1,
  pages = 1,
  total = 0,
  onPageChange,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  rowKey = (row) => row._id || row.id,
}) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-2/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3.5 whitespace-nowrap', col.headerClassName)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {data.map((row, idx) => (
              <tr
                key={rowKey(row, idx)}
                className="hover:bg-surface-2/60 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5 align-middle', col.cellClassName)}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-zinc-400">
          <span>
            Page <strong className="text-white">{page}</strong> of{' '}
            <strong className="text-white">{pages}</strong> ({total} total)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-surface-2 border border-border-subtle px-2.5 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-surface-2 border border-border-subtle px-2.5 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
