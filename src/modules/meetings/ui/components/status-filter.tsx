import {
    CircleXIcon,
    CircleCheckIcon,
    ClockArrowUpIcon,
    VideoIcon,
    LoaderIcon,
} from "lucide-react";

import { CommandSelect } from "@/components/command-select";

import { MeetingStatus } from "../../types";
import { useMeetingsFilters } from "../../hooks/use-meetings-filters";


const options = [
   {
     id: MeetingStatus.Próximo,
     value: MeetingStatus.Próximo,
     children:(
        <div className="flex items-center gap-x-2 capitalize">
         <ClockArrowUpIcon/>
          {MeetingStatus.Próximo}
        </div>
     )
   },
   {
    id:MeetingStatus.Completado,
    value: MeetingStatus.Completado,
    children:(
        <div className="flex items-center gap-x-2 capitalize">
        <CircleCheckIcon/>
        {MeetingStatus.Completado}
        </div>
    ),
 },
    {
    id:MeetingStatus.Activo,
    value: MeetingStatus.Activo,
    children:(
        <div className="flex items-center gap-x-2 capitalize">
        <VideoIcon/>
        {MeetingStatus.Activo}
        </div>
    ),
 },
 {
    id:MeetingStatus.Procesando,
    value: MeetingStatus.Procesando,
    children:(
        <div className="flex items-center gap-x-2 capitalize">
        <LoaderIcon/>
        {MeetingStatus.Procesando}
        </div>
    ),
 },
 {
    id:MeetingStatus.Cancelado,
    value: MeetingStatus.Cancelado,
    children:(
        <div className="flex items-center gap-x-2 capitalize">
        <CircleXIcon/>
        {MeetingStatus.Cancelado}
        </div>
    ),
 },
];
export const StatusFilter =() => {
    const [filters, setFilters] = useMeetingsFilters();
    return (
        <CommandSelect
        placeholder="Estatus"
        className="h-9"
        options={options}
        onSelect={(value)=>setFilters({status: value as MeetingStatus})}
        onSearch={()=>{}}
        value={filters.status ?? ""}
        />
    );
};

 


