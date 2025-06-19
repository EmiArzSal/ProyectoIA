"use client";

import { useState } from "react";
import { PlusIcon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NewAgentDialog } from "./new-agent-dialog";
import { AgentsSearchFilter } from "./agents-search-filter";
import { DEFAULT_PAGE } from "@/constants";
import { useAgentsFilters } from "../../hooks/use-agents-filters";


export const AgentListHeader = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filters, setFilters] = useAgentsFilters();
    const isAnyFilterModified = !!filters.search;
    const onClearFilters = () => {
        setFilters({ 
            search: "",
            page: DEFAULT_PAGE,
        });
    };

    return (
    <>
        <NewAgentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        <div className="py-4 px-4 md:px-8 flex flex-col gap-y-4">
            <div className="flex items-center justify-between">
                <h5 className="font-medium text-xl">Mis Agentes</h5>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusIcon />
                    Nuevo Agente
                </Button>
            </div>
            <div className="flex items-center gap-x-2 p-1">
                <AgentsSearchFilter />
                {isAnyFilterModified && (
                    <Button variant="outline" size="sm" onClick={onClearFilters}>
                        <XCircleIcon className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    </>
    );
};