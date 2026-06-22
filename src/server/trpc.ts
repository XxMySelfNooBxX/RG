import { initTRPC } from '@trpc/server';

export type TRPCContext = {
  postId?: string;
  username?: string;
  redis: {
    get(key: string): Promise<string | undefined>;
    incrBy(key: string, value: number): Promise<number>;
  };
  reddit: {
    getCurrentUsername(): Promise<string | undefined>;
  };
};

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  init: publicProcedure.query(async ({ ctx }) => {
    const count = await ctx.redis.get('count');
    return {
      postId: ctx.postId ?? '',
      count: count ? parseInt(count) : 0,
      username: ctx.username ?? 'anonymous',
    };
  }),
  increment: publicProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.redis.incrBy('count', 1);
    return { count, postId: ctx.postId ?? '' };
  }),
  decrement: publicProcedure.mutation(async ({ ctx }) => {
    const count = await ctx.redis.incrBy('count', -1);
    return { count, postId: ctx.postId ?? '' };
  }),
});

export type AppRouter = typeof appRouter;
