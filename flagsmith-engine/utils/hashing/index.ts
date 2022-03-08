import md5 from 'md5';
import bigInt from 'big-integer';

// def get_hashed_percentage_for_object_ids(
//   object_ids: typing.Iterable[typing.Any], iterations: int = 1
// ) -> float:
//   """
//   Given a list of object ids, get a floating point number between 0 and 1 based on
//   the hash of those ids. This should give the same value every time for any
//   list of ids.

//   :param object_ids: list of object ids to calculate the has for
//   :param iterations: num times to include each id in the generated string to hash
//   :return: (float) number between 0 (inclusive) and 100 (exclusive)
//   """

const makeRepeated = (arr: Array<any>, repeats: number) =>
    Array.from({ length: repeats }, () => arr).flat();

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

export function getHashedPercentateForObjIds(objectIds: Array<any>, iterations = 1): number {
    let to_hash = makeRepeated(objectIds, iterations).join(',');
    const hashedValue = md5(to_hash);
    const hashedInt = bigInt(h2d(hashedValue));
    const value = (hashedInt.mod(9999).toJSNumber() / 9998) * 100;

    if (value === 100) {
        return getHashedPercentateForObjIds(objectIds, iterations + 1);
    }

    return value;
}
