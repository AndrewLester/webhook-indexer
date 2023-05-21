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

import { Environment } from './environment';
import IndexFactory from './indexFactory';
import * as transforms from './transformer';

export async function createAlgoliaFragments(post: any, ignoreSlugs: string[]) {
	const node = [];

	// Transformer methods need an Array of Objects
	node.push(post);

	// Transform into Algolia object with the properties we need
	const algoliaObject = transforms.transformToAlgoliaObject(node, ignoreSlugs);

	// Create fragments of the post
	return await algoliaObject.reduce(async (prevPromise, cur) => {
		const prev = await prevPromise;
		return transforms.fragmentTransformer(prev, cur);
	}, Promise.resolve([]));
}

export async function saveAlgoliaFragments(fragments: any, algoliaSettings: any) {
	const index = new IndexFactory(algoliaSettings);
	await index.setSettingsForIndex();
	await index.save(fragments);
}

export async function removeSlug(slug: string, algoliaSettings: any) {
	const index = new IndexFactory(algoliaSettings);
	await index.initIndex();
	await index.delete(slug);
}

export function getAlgoliaSettings(env: Environment) {
	return {
		appId: env.ALGOLIA_APP_ID,
		apiKey: env.ALGOLIA_API_KEY,
		index: env.ALGOLIA_INDEX,
	};
}

export async function getIgnoreSlugs(env: Environment) {
	return (await env.INDEXER_CONFIG.get('IGNORE_SLUGS'))?.split(',') ?? [];
}
