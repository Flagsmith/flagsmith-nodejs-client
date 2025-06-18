import { randomUUID as uuidv4 } from 'node:crypto';
import { getHashedPercentateForObjIds } from '../../../../flagsmith-engine/utils/hashing/index.js';

describe('getHashedPercentageForObjIds', () => {
    it.each([[[12, 93]], [[uuidv4(), 99]], [[99, uuidv4()]], [[uuidv4(), uuidv4()]]])(
        'returns x where 0 <= x < 100',
        (objIds: (string | number)[]) => {
            let result = getHashedPercentateForObjIds(objIds);
            expect(result).toBeLessThan(100);
            expect(result).toBeGreaterThanOrEqual(0);
        }
    );

    it.each([[[12, 93]], [[uuidv4(), 99]], [[99, uuidv4()]], [[uuidv4(), uuidv4()]]])(
        'returns the same value each time',
        (objIds: (string | number)[]) => {
            let resultOne = getHashedPercentateForObjIds(objIds);
            let resultTwo = getHashedPercentateForObjIds(objIds);
            expect(resultOne).toEqual(resultTwo);
        }
    );

    it('is unique for different object ids', () => {
        let resultOne = getHashedPercentateForObjIds([14, 106]);
        let resultTwo = getHashedPercentateForObjIds([53, 200]);
        expect(resultOne).not.toEqual(resultTwo);
    });

    it('is evenly distributed', () => {
        // copied from python test here:
        // https://github.com/Flagsmith/flagsmith-engine/blob/main/tests/unit/utils/test_utils_hashing.py#L56
        const testSample = 500;
        const numTestBuckets = 50;
        const testBucketSize = Math.floor(testSample / numTestBuckets);
        const errorFactor = 0.1;

        // Given
        let objectIdPairs = Array.from(Array(testSample).keys()).flatMap(d =>
            Array.from(Array(testSample).keys()).map(e => [d, e].flat())
        );

        // When
        let values = objectIdPairs.map(objIds => getHashedPercentateForObjIds(objIds));

        // Then
        for (let i = 0; i++; i < numTestBuckets) {
            let bucketStart = i * testBucketSize;
            let bucketEnd = (i + 1) * testBucketSize;
            let bucketValueLimit = Math.min(
                (i + 1) / numTestBuckets + errorFactor + (i + 1) / numTestBuckets,
                1
            );

            for (let i = bucketStart; i++; i < bucketEnd) {
                expect(values[i]).toBeLessThanOrEqual(bucketValueLimit);
            }
        }
    });
});
