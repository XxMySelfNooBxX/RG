import { initTRPC, TRPCError } from '@trpc/server';
import { cases } from '../shared/data/cases';
import { Case } from '../shared/types';
import { getRankProgress } from '../shared/utils/ranks';

export type TRPCContext = {
  postId?: string;
  username?: string;
  redis: {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<string>;
    incrBy(key: string, value: number): Promise<number>;
    zAdd(key: string, options: { member: string; score: number }): Promise<number>;
    zRange(key: string, min: number, max: number, options?: any): Promise<{ member: string; score: number }[]>;
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

  submitTheory: publicProcedure
    .input((val: unknown) => {
      const data = val as any;
      if (!data || typeof data.caseId !== 'string' || typeof data.theory !== 'string' || typeof data.timestamp !== 'number' || !Array.isArray(data.connections)) {
        throw new Error('Invalid input');
      }
      return {
        caseId: data.caseId as string,
        theory: data.theory as string,
        timestamp: data.timestamp as number,
        connections: data.connections as { clueA_id: string; clueB_id: string }[],
      };
    })
    .mutation(async ({ input, ctx }) => {
      const username = ctx.username || 'anonymous';
      
      // Need to find the case and derive its dayNumber for release calculation
      const startDate = new Date('2026-06-17T00:00:00Z');
      const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
      
      let selectedCase: Case | null = null;
      let dayNumber = 0;
      
      // Cases in data/cases.ts don't have dayNumber, it's calculated in date.ts based on date
      // We will just find the case index and infer dayNumber
      const caseIndex = cases.findIndex(c => c.id === input.caseId);
      if (caseIndex !== -1) {
          selectedCase = cases[caseIndex] || null;
          // Determine the day number the user is submitting for. We assume it's the current active day for the case
          // Or we can just calculate it from the timestamp
          const submitDate = new Date(input.timestamp);
          const currentUTC = Date.UTC(submitDate.getUTCFullYear(), submitDate.getUTCMonth(), submitDate.getUTCDate());
          const diffTime = Math.max(0, currentUTC - startUTC);
          dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      if (!selectedCase) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Case not found' });
      }

      // BFS to find max connected component of evidence clues
      const evidenceIds = new Set(selectedCase.evidenceClueIds);
      const adj = new Map<string, string[]>();
      
      for (const conn of input.connections) {
          if (!adj.has(conn.clueA_id)) adj.set(conn.clueA_id, []);
          if (!adj.has(conn.clueB_id)) adj.set(conn.clueB_id, []);
          adj.get(conn.clueA_id)!.push(conn.clueB_id);
          adj.get(conn.clueB_id)!.push(conn.clueA_id);
      }

      let maxEvidenceConnected = 0;
      const globalVisited = new Set<string>();

      for (const node of evidenceIds) {
          if (globalVisited.has(node)) continue;
          if (!adj.has(node)) continue;

          let componentEvidenceCount = 0;
          const visited = new Set<string>();
          const queue = [node];

          while (queue.length > 0) {
              const current = queue.shift()!;
              if (!visited.has(current)) {
                  visited.add(current);
                  globalVisited.add(current);
                  
                  if (evidenceIds.has(current)) {
                      componentEvidenceCount++;
                  }

                  const neighbors = adj.get(current) || [];
                  for (const neighbor of neighbors) {
                      if (!visited.has(neighbor)) {
                          queue.push(neighbor);
                      }
                  }
              }
          }

          if (componentEvidenceCount > maxEvidenceConnected) {
              maxEvidenceConnected = componentEvidenceCount;
          }
      }

      // Calculate speed bonus
      const caseReleaseTimestamp = startUTC + (dayNumber - 1) * 24 * 60 * 60 * 1000;
      let speedBonus = 0;
      if (input.timestamp >= caseReleaseTimestamp && input.timestamp <= caseReleaseTimestamp + 3600000) {
          speedBonus = 100;
      }

      const displayScore = 1000 + (maxEvidenceConnected * 500) + speedBonus;
      
      // Composite leaderboard score for tiebreaking
      // (evidenceConnected * 1000000) + speedBonus + (9999999999 - timestamp)
      // To ensure JS precision, we make sure it doesn't exceed Number.MAX_SAFE_INTEGER
      // 9999999999 is only ~10 billion, but timestamp is ~1.7 trillion (epoch ms).
      // So (9999999999999 - timestamp) is better.
      const compositeScore = (maxEvidenceConnected * 100000000000) + (speedBonus * 100000000) + ((9999999999999 - input.timestamp) / 100);

      const submission = {
          caseId: input.caseId,
          theory: input.theory,
          connections: input.connections,
          score: displayScore,
          evidenceConnected: maxEvidenceConnected,
          totalEvidence: evidenceIds.size,
          submittedAt: input.timestamp
      };

      await ctx.redis.set(`theory:${input.caseId}:${username}`, JSON.stringify(submission));
      await ctx.redis.zAdd(`leaderboard:${input.caseId}`, { member: username, score: compositeScore });

      const casesSolvedStr = await ctx.redis.get(`player:${username}:casesSolved`);
      let casesSolved = casesSolvedStr ? parseInt(casesSolvedStr, 10) : 0;
      
      if (displayScore > 0) {
          casesSolved += 1;
          await ctx.redis.set(`player:${username}:casesSolved`, casesSolved.toString());
      }

      const rankData = getRankProgress(casesSolved);

      return { 
          success: true, 
          score: displayScore, 
          evidenceConnected: maxEvidenceConnected, 
          totalEvidence: evidenceIds.size,
          rankData: {
              casesSolved,
              ...rankData
          }
      };
    }),

  getPlayerProgress: publicProcedure
    .query(async ({ ctx }) => {
      const username = ctx.username || 'anonymous';
      const casesSolvedStr = await ctx.redis.get(`player:${username}:casesSolved`);
      const casesSolved = casesSolvedStr ? parseInt(casesSolvedStr, 10) : 0;
      
      const rankData = getRankProgress(casesSolved);
      return {
          casesSolved,
          ...rankData
      };
    }),

  getTheory: publicProcedure
    .input((val: unknown) => {
      const data = val as any;
      if (!data || typeof data.caseId !== 'string') throw new Error('Invalid input');
      return { caseId: data.caseId as string };
    })
    .query(async ({ input, ctx }) => {
      const username = ctx.username || 'anonymous';
      const data = await ctx.redis.get(`theory:${input.caseId}:${username}`);
      if (!data) return null;
      return JSON.parse(data);
    }),

  getLeaderboard: publicProcedure
    .input((val: unknown) => {
      const data = val as any;
      if (!data || typeof data.caseId !== 'string') throw new Error('Invalid input');
      return { caseId: data.caseId as string };
    })
    .query(async ({ input, ctx }) => {
      const rawMembers = await ctx.redis.zRange(`leaderboard:${input.caseId}`, 0, 9, { reverse: true, by: 'rank' });
      // If devvit redis zRange returns strings instead of objects, map them
      const members = Array.isArray(rawMembers) ? rawMembers : [];
      
      const result = [];
      for (const m of members) {
          const username = typeof m === 'object' ? m.member : m;
          const data = await ctx.redis.get(`theory:${input.caseId}:${username}`);
          if (data) {
              const parsed = JSON.parse(data);
              result.push({
                  username,
                  theory: parsed.theory,
                  score: parsed.score,
                  timestamp: parsed.submittedAt
              });
          }
      }
      return result;
    })
});

export type AppRouter = typeof appRouter;
