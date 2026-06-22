import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);

import { context, redis, reddit } from '@devvit/web/server';

app.all('/api/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: async () => {
      const username = await reddit.getCurrentUsername();
      return {
        postId: context.postId,
        username: username ?? 'anonymous',
        redis,
        reddit,
      };
    },
  });
});

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
