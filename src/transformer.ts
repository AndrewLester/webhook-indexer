// @ts-nocheck
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

import HtmlExtractor from 'algolia-html-extractor';
const Extractor = new HtmlExtractor();

/**
 * Utility function, takes the output of HTML Extractor, and reduces it back down
 * So that there is a group of HTML/content per heading
 *
 * @param {Array} accumulator
 * @param {Object} fragment
 */
export const reduceFragmentsUnderHeadings = (accumulator, fragment) => {
	const existingFragment = accumulator.find(existing => existing.anchor === fragment.anchor);

	if (existingFragment) {
		// Merge our fragments together
		if (fragment.node && fragment.node.tagName === `PRE`) {
			// For pre-tags, we don't keep all the markup
			existingFragment.html += ` ${fragment.content}`; // keep a space
			existingFragment.content += ` ${fragment.content}`; // keep a space
		} else {
			existingFragment.html += fragment.html;
			existingFragment.content += ` ${fragment.content}`; // keep a space
		}
	} else {
		// If we don't already have a matching fragment with this anchor, add it
		accumulator.push(fragment);
	}

	return accumulator;
};

/**
 * Fragment Transformer
 * breaks down large HTML strings into sensible fragments based on headings
 */
export const fragmentTransformer = async (recordAccumulator, node) => {
	let htmlFragments = (await Extractor.run(node.html, { cssSelector: `p,pre,td,li` })).reduce(
		reduceFragmentsUnderHeadings,
		[]
	);

	// convert our fragments for this node into valid objects, and merge int the
	const records = htmlFragments.reduce((fragmentAccumulator, fragment, index) => {
		// Don't need a reference to the html node type
		delete fragment.node;
		// For now at least, we're not going to index the content string
		// The HTML string is already very long, and there are size limits
		delete fragment.content;
		// If we have an anchor, change the URL to be a deep link
		if (fragment.anchor) {
			fragment.url = `${node.url}#${fragment.anchor}`;
		}

		let objectID = `${node.objectID}_${index}`;

		// TODO: switch this on in verbose mode only
		// // If fragments are too long, we need this to see which fragment it was
		// console.log(`Created fragment: `, objectID, fragment.url || node.url, fragment.html.length); // eslint-disable-line no-console

		return [...fragmentAccumulator, { ...node, ...fragment, objectID: objectID }];
	}, []);

	return [...recordAccumulator, ...records];
};

export const _testReduceFragmentsUnderHeadings = reduceFragmentsUnderHeadings;

/**
 * Algolia Object Transformer
 * takes a Ghost post and selects the properties needed to send to Algolia
 *
 *  @param {Array} posts
 */
export const transformToAlgoliaObject = (posts, ignoreSlugs) => {
	const algoliaObjects = [];

	posts.map(post => {
		// Define the properties we need for Algolia
		const algoliaPost = {
			objectID: post.id,
			slug: post.slug,
			url: post.url,
			html: post.html,
			image: post.feature_image,
			title: post.title,
			createdAt: post.created_at,
			updatedAt: post.updated_at,
			tags: [],
			authors: [],
		};

		// If we have an array of slugs to ignore, and the current
		// post slug is in that list, skip this loop iteration
		if (ignoreSlugs) {
			if (ignoreSlugs.includes(post.slug)) {
				return false;
			}
		}

		if (post.tags && post.tags.length) {
			post.tags.forEach(tag => {
				algoliaPost.tags.push({ name: tag.name, slug: tag.slug });
			});
		}

		if (post.authors && post.authors.length) {
			post.authors.forEach(author => {
				algoliaPost.authors.push({ name: author.name, slug: author.slug });
			});
		}

		algoliaObjects.push(algoliaPost);

		return algoliaPost;
	});

	return algoliaObjects;
};
