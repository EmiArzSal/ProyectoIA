import { z } from "zod";
// import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// import { useMutation, useQueryClient } from "@tanstack/react-query";

// import { useTRPC } from "@/trpc/client";

import { Input } from "@/components/ui/input";
import { Button} from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from "@/components/ui/form"

import { AgentGetOne } from "../../types";
import { agentsInsertSchema } from "../../schemas";



interface AgentFormProps {
   // onSuccess?: () => void;
   onCancel?: () => void;
   initialValues?:  AgentGetOne;

};

 export const AgentForm = ({
   // onSuccess,
   onCancel,
   initialValues
}: AgentFormProps) => {
   // const trpc = useTRPC();
   // const queryClient = useQueryClient();

   // const createAgent = useMutation(
   //    trpc.agents.create.mutationOptions({
   //       onSuccess: async () => {
   //          await queryClient.invalidateQueries(
   //             trpc.agents.getMany.queryOptions({}),
   //          );
   //          onSuccess?.();
   //       },
   //       onError: (error) => {
   //          toast.error(error.message);

   //          //TODO :check if error code is "FORBIDDEN", redirect to "/upgrade"
   //       },
   //    }),
   // );

   // const updateAgent = useMutation(
   //    trpc.agents.update.mutationOptions({
   //       onSuccess: async () => {
   //          await queryClient.invalidateQueries(
   //             trpc.agents.getMany.queryOptions({}),
   //          );
   //          if(initialValues?.id){
   //             await queryClient.invalidateQueries(
   //                trpc.agents.getOne.queryOptions({id: initialValues.id}),
   //             );
   //          }
   //          onSuccess?.();
   //       },
   //       onError: (error) => {
   //          toast.error(error.message);

   //          //TODO :check if error code is "FORBIDDEN", redirect to "/upgrade"
   //       },
   //    }),
   // );

   const form = useForm<z.infer<typeof agentsInsertSchema>>({
      resolver: zodResolver(agentsInsertSchema),
      defaultValues: {
         name: initialValues?.name ?? "",
         instructions: initialValues?.instructions ?? "",
      },
   });

   const isEdit = !!initialValues?.id;
   // const isPending = createAgent.isPending || updateAgent.isPending;

   const onSubmit = () => {
      // Do nothing - mutations are commented out
   };
   return(
         <Form{...form}>
         <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <GeneratedAvatar
            seed={form.watch("name")}
            variant="botttsNeutral"
            className="border size-16"
            />
            <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
               <FormItem>
               <FormLabel>Nombre</FormLabel>
               <FormControl>
                  <Input {...field} placeholder="e.j. Agente de Análisis Vectorial"/>
               </FormControl>
               <FormMessage/>
               </FormItem>
            )}
            />
            <FormField
            name="instructions"
            control={form.control}
            render={({ field }) => (
               <FormItem>
               <FormLabel>Instrucciones</FormLabel>
               <FormControl>
                  <Textarea
                  {...field} placeholder="Puedes ayudarme con esta Tarea."/>
               </FormControl>
               <FormMessage/>
               </FormItem>
            )}
            />
            <div className="flex justify-between gapx-2">
               {onCancel && (
               <Button
               variant="ghost"
               disabled={false}
               type="button"
               onClick={()=>onCancel()}
               >
                  Cancelar

               </Button>
               )}
               <Button disabled={false} type="submit">
               {isEdit ? "Update" : "Crear"}
               </Button>
            </div>
            </form>
         </Form>
   );

};