import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRightIcon, TrashIcon, PencilIcon, MoreVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface Props {
  agentId: string;
  agentName: string,
  onEdit: () => void,
  onRemove: () => void,
}

export const AgentIdViewHeader = ({ agentId, agentName, onEdit, onRemove }: Props) => {
  return (
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="font-medium text-xl">
                <Link href="/agentes">
                  Mis Agentes
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-foreground text-xl font-medium [&_svg]:size-4">
              <ChevronRightIcon/>
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="font-medium text-xl text-foreground">
                <Link href={`/agentes/${agentId}`}>
                  {agentName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {/* Sin modal={false}, el dialogo que este dropdown abre, causa que el sitio web se quede bloqueado*/}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVerticalIcon className="size-4"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon className="size-4 text-black"/>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove}>
              <TrashIcon className="size-4 text-red-500"/>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

  );
};