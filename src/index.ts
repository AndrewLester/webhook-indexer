/**
 * https://github.com/TryGhost/algolia/tree/main
 * MIT License
Copyright (c) 2013-2022 Ghost Foundation
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import { Router, IRequest } from 'itty-router';
import IndexFactory from './indexFactory';
import * as transforms from './transformer';

interface Environment {
	INDEXER_CONFIG: KVNamespace;
	ALGOLIA_APP_ID: string;
	ALGOLIA_API_KEY: string;
	ALGOLIA_INDEX: string;
	WEBHOOK_SECRET: string;
}

const router = Router();

router.post('/published', async (request, env: Environment) => {
	if (!isAuthorized(request, env)) {
		return new Response('Forbidden', { status: 403 });
	}

	if (!(await isEnabled(env))) {
		return new Response('Algolia is not activated', {
			status: 400,
		});
	}

	const algoliaSettings = {
		appId: env.ALGOLIA_APP_ID,
		apiKey: env.ALGOLIA_API_KEY,
		index: env.ALGOLIA_INDEX,
	};

	let post: any;
	try {
		post = (await request.json()).post;
	} catch (e) {
		console.log(e);
		return new Response('Needs JSON', { status: 400 });
	}
	post = (post && Object.keys(post.current).length > 0 && post.current) || {};

	if (!post || Object.keys(post).length < 1) {
		return new Response('No valid request body detected', { status: 400 });
	}

	const node = [];

	// Transformer methods need an Array of Objects
	node.push(post);

	// Transform into Algolia object with the properties we need
	const algoliaObject = transforms.transformToAlgoliaObject(
		node,
		(await env.INDEXER_CONFIG.get('IGNORE_SLUGS'))?.split(',')
	);

	// Create fragments of the post
	const fragments = await algoliaObject.reduce(async (prevPromise, cur) => {
		const prev = await prevPromise;
		return transforms.fragmentTransformer(prev, cur);
	}, Promise.resolve([]));

	try {
		// Instanciate the Algolia indexer, which connects to Algolia and
		// sets up the settings for the index.
		const index = new IndexFactory(algoliaSettings);
		await index.setSettingsForIndex();
		await index.save(fragments);
		console.log('Fragments successfully saved to Algolia index'); // eslint-disable-line no-console
		return new Response(`Post "${post.title}" has been added to the index.`, { status: 200 });
	} catch (error) {
		console.log(error); // eslint-disable-line no-console
		return new Response('error', { status: 500 });
	}
});

router.post('/unpublished', async (request, env) => {
	if (!isAuthorized(request, env)) {
		return new Response('Forbidden', { status: 403 });
	}

	if (!(await isEnabled(env))) {
		return new Response('Algolia is not activated', {
			status: 400,
		});
	}

	const algoliaSettings = {
		appId: env.ALGOLIA_APP_ID,
		apiKey: env.ALGOLIA_API_KEY,
		index: env.ALGOLIA_INDEX,
	};

	const { post } = await request.json();

	// Updated posts are in `post.current`, deleted are in `post.previous`
	const { slug } =
		(post.current && Object.keys(post.current).length && post.current) ||
		(post.previous && Object.keys(post.previous).length && post.previous);

	if (!slug) {
		return new Response('No valid request body detected', { status: 400 });
	}

	try {
		// Instanciate the Algolia indexer, which connects to Algolia and
		// sets up the settings for the index.
		const index = new IndexFactory(algoliaSettings);
		await index.initIndex();
		await index.delete(slug);
		console.log(`Fragments for slug "${slug}" successfully removed from Algolia index`); // eslint-disable-line no-console
		return new Response(`Post "${slug}" has been removed from the index.`, { status: 200 });
	} catch (error) {
		console.log(error); // eslint-disable-line no-console
		return new Response('error', { status: 500 });
	}
});

router.all('*', () => new Response(null, { status: 404 }));

async function isEnabled(env: Environment) {
	return (await env.INDEXER_CONFIG.get('ENABLED')) === '1';
}

function isAuthorized(request: IRequest, env: Environment) {
	const { secret } = request.query;
	return secret === env.WEBHOOK_SECRET;
}

export default {
	fetch: router.handle, // yep, it's this easy.
};
