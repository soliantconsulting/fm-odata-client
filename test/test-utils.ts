import type {SinonMatcher} from 'sinon';
import sinon from 'sinon';
import type {FetchParams} from '../src';

export const matchFetchParams = (expected : FetchParams) : SinonMatcher => sinon.match((actual : FetchParams) => {
    if (expected.method !== actual.method) {
        return false;
    }

    if (expected.body !== actual.body) {
        return false;
    }

    if (expected.contentType !== actual.contentType) {
        return false;
    }

    if (expected.search) {
        if (!actual.search) {
            return false;
        }

        expected.search.sort();
        actual.search.sort();

        if (actual.search.toString() !== expected.search.toString()) {
            return false;
        }
    } else if (actual.search) {
        return false;
    }

    return true;
});
