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
