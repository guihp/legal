import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { buildPaginationRange } from './helpers';

type Props = {
  shown: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PropertiesPagination({
  shown,
  total,
  page,
  totalPages,
  onPageChange,
}: Props) {
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
      <p className="text-sm text-muted-foreground">
        Exibindo <span className="font-semibold text-foreground">{shown}</span> de {total} imóvel
        {total !== 1 ? 's' : ''}
      </p>

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-full sm:w-auto justify-start sm:justify-end">
          <PaginationContent className="flex-wrap justify-start sm:justify-end">
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Página anterior"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.max(1, page - 1));
                }}
                className={cn('gap-1 pl-2.5', page <= 1 && 'pointer-events-none opacity-50')}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </PaginationLink>
            </PaginationItem>

            {buildPaginationRange(page, totalPages).map((item, idx) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(item);
                    }}
                    className={cn(
                      item === page &&
                        'btn-on-emerald border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-700 hover:text-white dark:bg-emerald-700 dark:border-emerald-700',
                    )}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Próxima página"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Math.min(totalPages, page + 1));
                }}
                className={cn(
                  'gap-1 pr-2.5',
                  page >= totalPages && 'pointer-events-none opacity-50',
                )}
              >
                <span>Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
