import { afterEach, describe, expect, it } from 'vitest';
import { closeServer, startServer } from '../src/index.js';

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('deployment server', () => {
  it('serves a health endpoint on a dynamic port', async () => {
    const server = await startServer({ port: 0, autoRunPipeline: false });
    servers.push(server);

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not bind to a port');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('ok');
  });
});
