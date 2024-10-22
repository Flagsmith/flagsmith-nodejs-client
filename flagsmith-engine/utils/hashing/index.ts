import {BinaryLike, createHash} from "node:crypto";

const md5 = (data: BinaryLike) => createHash('md5').update(data).digest('hex')

const makeRepeated = (arr: Array<any>, repeats: number) =>
    Array.from({ length: repeats }, () => arr).flat();

// https://stackoverflow.com/questions/12532871/how-to-convert-a-very-large-hex-number-to-decimal-in-javascript
/**
 * Given a list of object ids, get a floating point number between 0 and 1 based on
 * the hash of those ids. This should give the same value every time for any list of ids.
 *
 * @param  {Array<any>} objectIds list of object ids to calculate the has for
 * @param  {} iterations=1 num times to include each id in the generated string to hash
 * @returns number number between 0 (inclusive) and 100 (exclusive)
 */
export function getHashedPercentateForObjIds(objectIds: Array<any>, iterations = 1): number {
    let toHash = makeRepeated(objectIds, iterations).join(',');
    const hashedValue = md5(toHash);
    const hashedInt = BigInt('0x' + hashedValue);
    const value = (Number((hashedInt % 9999n)) / 9998.0) * 100;

    // we ignore this for it's nearly impossible use case to catch
    /* istanbul ignore next */
    if (value === 100) {
        /* istanbul ignore next */
        return getHashedPercentateForObjIds(objectIds, iterations + 1);
    }

    return value;
}
