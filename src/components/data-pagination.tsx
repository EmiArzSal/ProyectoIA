import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface Props{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void; 
}

export const DataPagination = ({ page, totalPages, onPageChange }: Props) => {
  return (
    <div className="flex items-center justify-center gap-x-2">
      <div className="flex-1 text-sm text-muted-foreground">
        Página {page} de {totalPages || 1}
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}