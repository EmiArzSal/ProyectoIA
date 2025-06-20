import { z } from 'zod';

export const meetingsInsertSchema = z.object({
  name: z.string().min(1,{ message: 'Nombre es requerido' }),
  agentId: z.string().min(1,{ message: 'Agente requerido' }),
});

export const meetingsUpdateSchema = meetingsInsertSchema.extend({
  id: z.string().min(1,{ message: 'ID es requerido' }),
});
