import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { CommandSelect } from "@/components/command-select";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { useMeetingsFilters } from "../../hooks/use-meetings-filters";

export const AgentIdFilter = () => {
  const [filters, setFilters] = useMeetingsFilters();
  const trpc = useTRPC();
  const [agentSearch, setAgentSearch] = useState("");

  const { data } = useQuery(trpc.agents.getMany.queryOptions());

  const filteredAgents = (data ?? []).filter((agent) =>
    agent.role.toLowerCase().includes(agentSearch.toLowerCase())
  );

  return (
    <CommandSelect
      className="h-9"
      placeholder="Entrevistador"
      options={filteredAgents.map((agent) => ({
        id: agent.id,
        value: agent.id,
        children: (
          <div className="flex items-center gap-x-2">
            <GeneratedAvatar
              seed={agent.name}
              variant="botttsNeutral"
              className="size-4"
            />
            {agent.role}
          </div>
        ),
      }))}
      onSelect={(value) => setFilters({ agentId: value })}
      onSearch={setAgentSearch}
      value={filters.agentId ?? ""}
    />
  );
};
