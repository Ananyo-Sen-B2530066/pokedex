import { app, ensureDataReady } from '../../src/app';
import serverless from 'serverless-http';

// Adapter that mounts the Express app behind a Netlify Function. The frontend
// is served statically by Netlify (publish = public/); every other path is
// rewritten here by the netlify.toml catch-all redirect.
//
// serverless-http translates Netlify's AWS-Gateway-shaped event/context into a
// plain Node req/res for Express and back. We wrap it so the first invocation
// of a cold instance waits for the (sub-second, read-only) dataset load.
const wrapped = serverless(app);

export const handler = async (event: any, context: any) => {
  await ensureDataReady();
  return wrapped(event, context);
};