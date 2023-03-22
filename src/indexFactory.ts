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

import algoliaSearch from 'algoliaSearch';

// Any defined settings will override those in the algolia UI
// TODO: make this a custom setting
const REQUIRED_SETTINGS = {
	// We chunk our pages into small algolia entries, and mark them as distinct by slug
	// This ensures we get one result per page, whichever is ranked highest
	distinct: true,
	attributeForDistinct: `slug`,
	// This ensures that chunks higher up on a page rank higher
	customRanking: [`desc(customRanking.heading)`, `asc(customRanking.position)`],
	// Defines the order algolia ranks various attributes in
	searchableAttributes: [
		`title`,
		`headings`,
		`html`,
		`url`,
		`tags.name`,
		`tags`,
		`authors.name`,
		`authors`,
	],
	// Add slug to attributes we can filter by in order to find fragments to remove/delete
	attributesForFaceting: [`filterOnly(slug)`],
};

const AlgoliaError = ({ code, statusCode, originalError }) => {
	let error = new Error({ message: 'Error processing Algolia' }); // eslint-disable-line

	error.errorType = 'AlgoliaError';
	error.code = code;
	if (statusCode) {
		error.status = statusCode;
	}
	if (originalError.message) {
		error.message = originalError.message;
	}
	error.originalError = originalError;

	return error;
};

class IndexFactory {
	constructor(algoliaSettings = {}) {
		if (
			!algoliaSettings.apiKey ||
			!algoliaSettings.appId ||
			!algoliaSettings.index ||
			algoliaSettings.index.length < 1
		) {
			throw new Error('Algolia appId, apiKey, and index is required!'); // eslint-disable-line
		}
		this.index = [];
		this.options = algoliaSettings;

		this.options.indexSettings = algoliaSettings.indexSettings || REQUIRED_SETTINGS;
	}

	initClient() {
		this.client = algoliaSearch(this.options.appId, this.options.apiKey);
	}

	async initIndex() {
		this.initClient();
		this.index = await this.client.initIndex(this.options.index);
	}

	async setSettingsForIndex() {
		try {
			await this.initIndex();
			await this.index.setSettings(this.options.indexSettings);
			return await this.index.getSettings();
		} catch (error) {
			throw AlgoliaError({ code: error.code, statusCode: error.status, originalError: error });
		}
	}

	async save(fragments) {
		console.log(`Saving ${fragments.length} fragments to Algolia index...`); // eslint-disable-line no-console
		try {
			await this.index.saveObjects(fragments);
		} catch (error) {
			throw AlgoliaError({ code: error.code, statusCode: error.status, originalError: error });
		}
	}

	async delete(slug) {
		console.log(`Removing all fragments with post slug "${slug}"...`); // eslint-disable-line no-console
		try {
			await this.index.deleteBy({ filters: `slug:${slug}` });
		} catch (error) {
			throw AlgoliaError({ code: error.code, statusCode: error.status, originalError: error });
		}
	}

	async deleteObjects(fragments) {
		console.log(`Deleting ${fragments.length} fragments from Algolia index...`); // eslint-disable-line no-console
		try {
			await this.index.deleteObjects(fragments);
		} catch (error) {
			throw AlgoliaError({ code: error.code, statusCode: error.status, originalError: error });
		}
	}
}

export default IndexFactory;