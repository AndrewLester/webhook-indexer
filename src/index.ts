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

import { Router, IRequest, error, text, withContent } from 'itty-router';
import {
	createAlgoliaFragments,
	getAlgoliaSettings,
	getIgnoreSlugs,
	removeSlug,
	saveAlgoliaFragments,
} from './algolia';
import { Environment } from './environment';

const router = Router();

router
	.all('*', async (request, env: Environment) => {
		if (!(await isEnabled(env))) {
			return error(400);
		}

		if (!isAuthorized(request, env)) {
			return error(403);
		}
	})
	.all('*', withContent, async request => {
		if (!request.content.post) {
			return error(400, 'Needs JSON');
		}
	})
	.post('/published', async (request, env: Environment) => {
		const current = request.content.post?.current;
		if (!current) {
			return error(400, 'No valid request body detected');
		}

		const fragments = createAlgoliaFragments(current, await getIgnoreSlugs(env));

		try {
			await saveAlgoliaFragments(fragments, getAlgoliaSettings(env));
			console.log('Fragments successfully saved to Algolia index');
			return text(`Post "${current.title}" has been added to the index.`, { status: 200 });
		} catch (e) {
			console.log(e);
			return error(500);
		}
	})
	.post('/unpublished', async (request, env) => {
		const post = request.content.post;

		// Updated posts are in `post.current`, deleted are in `post.previous`
		const slug = post?.current?.slug || post?.previous?.slug;

		if (!slug) {
			return error(400, 'No valid request body detected');
		}

		try {
			await removeSlug(slug, getAlgoliaSettings(env));
			console.log(`Fragments for slug "${slug}" successfully removed from Algolia index`);
			return text(`Post "${slug}" has been removed from the index.`, { status: 200 });
		} catch (e) {
			console.log(e);
			return error(500);
		}
	})
	.post('/published/edited', async (request, env: Environment) => {
		const post = request.content.post;

		// Updated posts are in `post.current`, deleted are in `post.previous`
		const slug = post?.current?.slug || post?.previous?.slug;

		if (!slug) {
			return error(400, 'No valid request body detected');
		}

		try {
			await removeSlug(slug, getAlgoliaSettings(env));
		} catch (e) {
			console.log(e);
			return error(500);
		}

		const current = post.current;
		const fragments = createAlgoliaFragments(current, await getIgnoreSlugs(env));

		try {
			await saveAlgoliaFragments(fragments, getAlgoliaSettings(env));
			return text(`Post "${current.title}" has been updated in the index.`, { status: 200 });
		} catch (e) {
			console.log(e);
			return error(500);
		}
	})
	.all('*', () => new Response(null, { status: 404 }));

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
