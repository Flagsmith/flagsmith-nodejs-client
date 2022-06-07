import md5 from 'md5';
import bigInt from 'big-integer';

const makeRepeated = (arr: Array<any>, repeats: number) =>
    Array.from({ length: repeats }, () => arr).flat();

// https://stackoverflow.com/questions/12532871/how-to-convert-a-very-large-hex-number-to-decimal-in-javascript
function h2d(s: any): string {
    function add(x: any, y: any) {
        var c = 0,
            r = [];
        var x = x.split('').map(Number);
        var y = y.split('').map(Number);
        while (x.length || y.length) {
            var s = (x.pop() || 0) + (y.pop() || 0) + c;
            r.unshift(s < 10 ? s : s - 10);
            c = s < 10 ? 0 : 1;
        }
        if (c) r.unshift(c);
        return r.join('');
    }

    var dec = '0';
    s.split('').forEach(function (chr: any) {
        var n = parseInt(chr, 16);
        for (var t = 8; t; t >>= 1) {
            dec = add(dec, dec);
            if (n & t) dec = add(dec, '1');
        }
    });
    return dec;
}
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
    const hashedInt = bigInt(h2d(hashedValue));
    const value = (hashedInt.mod(9999).toJSNumber() / 9998) * 100;

    // we ignore this for it's nearly impossible use case to catch
    /* istanbul ignore next */
    if (value === 100) {
        /* istanbul ignore next */
        return getHashedPercentateForObjIds(objectIds, iterations + 1);
    }

    return value;
}
