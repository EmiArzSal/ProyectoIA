"use client";

import { XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingsSearchFilter } from "./meetings-search-filter";
import { StatusFilter } from "./status-filter";
import { AgentIdFilter } from "./agent-id-filter";
import { PeriodFilter } from "./period-filter";
import { useMeetingsFilters } from "../../hooks/use-meetings-filters";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DEFAULT_PAGE } from "@/constants";

export const MeetingsListHeader = () => {
  const [filters, setFilters] = useMeetingsFilters();

  const isAnyFilterModified =
    !!filters.status || !!filters.search || !!filters.agentId || !!filters.period;

  const onClearFilters = () => {
    setFilters({
      status: null,
      agentId: "",
      search: "",
      period: null,
      page: DEFAULT_PAGE,
    });
  };

  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-medium text-xl">Historial de entrevistas</h5>
          <p className="text-sm text-muted-foreground">
            Revisa tus prácticas de entrevista anteriores.
          </p>
        </div>
      </div>
      <ScrollArea>
        <div className="flex items-center gap-x-2 p-1">
          <MeetingsSearchFilter />
          <AgentIdFilter />
          <StatusFilter />
          <PeriodFilter />
          {isAnyFilterModified && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <XCircleIcon className="size-4" />
              Limpiar filtros
            </Button>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
