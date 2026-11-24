
import { agentsRouter } from '@/modules/agents/server/procedures';

import { createTRPCRouter } from '../init';
import { meetingsRouter } from '@/modules/meetings/server/procedures';
import { correctionsRouter } from '@/modules/corrections/server/procedures';
import { glossaryRouter } from '@/modules/glossary/server/procedures';
import { dictionaryRouter } from '@/modules/dictionary/server/procedures';
import { gamificationRouter } from '@/modules/gamification/server/procedures';
import { progressRouter } from '@/modules/progress/server/procedures';
import { consentRouter } from '@/modules/consent/server/procedures';
import { onboardingRouter } from '@/modules/onboarding/server/procedures';

export const appRouter = createTRPCRouter({
   agents: agentsRouter,
   meetings: meetingsRouter,
   corrections: correctionsRouter,
   glossary: glossaryRouter,
   dictionary: dictionaryRouter,
   gamification: gamificationRouter,
   progress: progressRouter,
   consent: consentRouter,
   onboarding: onboardingRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;