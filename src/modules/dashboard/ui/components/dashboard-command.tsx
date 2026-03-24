import {
  CommandResponsiveDialog,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
  CommandEmpty
 } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Dispatch, SetStateAction, useState } from 'react';
import { useTRPC } from '@/trpc/client';
import { GeneratedAvatar } from '@/components/ui/generated-avatar';


interface Props{
  open:boolean,
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export const DashboardCommand = ({ open, setOpen }: Props) => {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const trpc = useTRPC();
  const meetings = useQuery(
    trpc.meetings.getMany.queryOptions({
      search,
      pageSize: 100,
    })
  );
  const agents = useQuery(trpc.agents.getMany.queryOptions());
  return (
    <CommandResponsiveDialog shouldFilter={false} open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder='Encuentra una entrevista o un agente...'
        value={search}
        onValueChange={(value) => setSearch(value)}
      />
      <CommandList>
        <CommandGroup heading='entrevistas'>
          <CommandEmpty>
            <span className='text-sm text-muted-foreground'>
              No se encontraron entrevistas
            </span>
          </CommandEmpty>
          {meetings.data?.items.map((meeting) => (
            <CommandItem 
              onSelect={() => {
                router.push(`/meetings/${meeting.id}`);
                setOpen(false);
              }}
              key={meeting.id}
            >
              {meeting.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading='Agentes'>
          <CommandEmpty>
            <span className='text-sm text-muted-foreground'>
              No se encontraron agentes
            </span>
          </CommandEmpty>
          {agents.data?.map((agent) => (
            <CommandItem
              onSelect={() => {
                router.push(`/agentes/${agent.id}`);
                setOpen(false);
              }}
              key={agent.id}
            >
              <GeneratedAvatar
                seed={agent.name}
                variant="botttsNeutral"
                className="size-5"
              />
              {agent.role}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandResponsiveDialog>
  )
}