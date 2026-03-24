import { CommandSelect } from "@/components/command-select";
import { useMeetingsFilters } from "../../hooks/use-meetings-filters";
import { CalendarIcon } from "lucide-react";

const options = [
  {
    id: "week",
    value: "week",
    children: (
      <div className="flex items-center gap-x-2">
        <CalendarIcon className="size-4" />
        Esta semana
      </div>
    ),
  },
  {
    id: "month",
    value: "month",
    children: (
      <div className="flex items-center gap-x-2">
        <CalendarIcon className="size-4" />
        Este mes
      </div>
    ),
  },
  {
    id: "quarter",
    value: "quarter",
    children: (
      <div className="flex items-center gap-x-2">
        <CalendarIcon className="size-4" />
        Últimos 3 meses
      </div>
    ),
  },
];

export const PeriodFilter = () => {
  const [filters, setFilters] = useMeetingsFilters();

  return (
    <CommandSelect
      placeholder="Período"
      className="h-9"
      options={options}
      onSelect={(value) =>
        setFilters({ period: value as "week" | "month" | "quarter" })
      }
      onSearch={() => {}}
      value={filters.period ?? ""}
    />
  );
};
