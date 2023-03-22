import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const testSecret = 'testing';

describe('Worker', () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev('src/index.ts', {
			experimental: {
				disableExperimentalWarning: true,
			},
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	it('should return unauthorized without secret', async () => {
		const req = new Request('http://localhost/published', {
			method: 'POST',
		});
		const resp = await worker.fetch(req);
		expect(resp.status).toBe(403);
	});
});
