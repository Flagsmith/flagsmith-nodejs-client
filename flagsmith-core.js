const fetch = require('node-fetch');

module.exports = class FlagsmithCore {
    normalizeFlags(flags) {
        const _flags = {};

        for (const { feature, enabled, feature_state_value } of flags) {
            const normalizedKey = feature.name.toLowerCase().replace(/ /g, '_');
            _flags[normalizedKey] = {
                enabled,
                value: feature_state_value
            };
        }

        return _flags;
    }

    normalizeTraits(traits) {
        const _traits = {};

        for (const { trait_key, trait_value } of traits) {
            const normalizedKey = trait_key.toLowerCase().replace(/ /g, '_');
            _traits[normalizedKey] = trait_value;
        }

        return _traits;
    }

    async getJSON(url, method, body) {
        const { environmentID } = this;
        const options = {
            method: method || 'GET',
            body,
            headers: {
                'x-environment-key': environmentID
            }
        };

        if (method !== 'GET') {
            options.headers['Content-Type'] = 'application/json; charset=utf-8';
        }

        const res = await fetch(url, options);
        const result = await res.json();

        if (res.status >= 400) {
            throw new Error(result.detail);
        }

        return result;
    }

    init({ environmentID, api, onError, cache }) {
        if (!environmentID) {
            throw new Error('Please specify a environment id');
        }

        this.environmentID = environmentID;

        this.api = api || 'https://api.flagsmith.com/api/v1';
        this.onError = onError;

        if (cache) {
            const missingMethods = [];

            ['has', 'get', 'set'].forEach(method => {
                if (!cache[method]) missingMethods.push(method);
            });

            if (missingMethods.length > 0) {
                throw new Error(
                    `Please implement the following methods in your cache: ${missingMethods.join(
                        ', '
                    )}`
                );
            }
        }

        this.cache = cache;
    }

    async getFlags() {
        if (this.cache && (await this.cache.has('flags'))) {
            return this.cache.get('flags');
        }

        const { onError, api } = this;

        try {
            const flags = await this.getJSON(`${api}/flags/`);
            const normalizedFlags = this.normalizeFlags(flags);

            if (this.cache) await this.cache.set('flags', normalizedFlags);

            return normalizedFlags;
        } catch (err) {
            onError && onError({ message: err.message });
            throw err;
        }
    }

    async getFlagsForUser(identity) {
        const cacheKey = `flags-${identity}`;

        if (this.cache && (await this.cache.has(cacheKey))) {
            return this.cache.get(cacheKey);
        }

        const { onError, api } = this;

        if (!identity) {
            const errMsg = 'getFlagsForUser() called without a user identity';
            onError && onError({ message: errMsg });
            throw new Error(errMsg);
        }

        try {
            const { flags } = await this.getJSON(`${api}/identities/?identifier=${identity}`);
            const normalizedFlags = this.normalizeFlags(flags);

            if (this.cache) await this.cache.set(cacheKey, normalizedFlags);

            return normalizedFlags;
        } catch (err) {
            onError && onError({ message: err.message });
            throw err;
        }
    }

    async getUserIdentity(identity) {
        const cacheKey = `flags_traits-${identity}`;

        if (this.cache && (await this.cache.has(cacheKey))) {
            return this.cache.get(cacheKey);
        }

        const { onError, api } = this;

        if (!identity) {
            const errMsg = 'getUserIdentity() called without a user identity';
            onError && onError({ message: errMsg });
            throw new Error(errMsg);
        }

        try {
            const { flags, traits } = await this.getJSON(
                `${api}/identities/?identifier=${identity}`
            );

            const normalizedFlags = this.normalizeFlags(flags);
            const normalizedTraits = this.normalizeTraits(traits);
            const res = { flags: normalizedFlags, traits: normalizedTraits };

            if (this.cache) await this.cache.set(cacheKey, res);

            return res;
        } catch (err) {
            onError && onError({ message: err.message });
            throw err;
        }
    }

    async getValue(key, userId) {
        const flags = userId ? await this.getFlagsForUser(userId) : await this.getFlags();

        return this.getValueFromFeatures(key, flags);
    }

    async hasFeature(key, userId) {
        const flags = userId ? await this.getFlagsForUser(userId) : await this.getFlags();

        return this.checkFeatureEnabled(key, flags);
    }

    getValueFromFeatures(key, flags) {
        if (!flags) return null;

        const flag = flags[key];

        //todo record check for value
        return flag ? flag.value : null;
    }

    checkFeatureEnabled(key, flags) {
        if (!flags) return false;

        const flag = flags[key];
        return flag && flag.enabled;
    }

    async getTrait(identity, key) {
        const { onError } = this;

        if (!identity || !key) {
            const errMsg = `getTrait() called without a ${
                !identity ? 'user identity' : 'trait key'
            }`;
            onError && onError({ message: errMsg });
            throw new Error(errMsg);
        }

        try {
            const { traits } = await this.getUserIdentity(identity);
            return traits[key];
        } catch (err) {
            onError && onError({ message: err.message });
            throw err;
        }
    }

    async setTrait(identity, key, value) {
        const { onError, api } = this;

        if (!identity || !key) {
            const errMsg = `setTrait() called without a ${
                !identity ? 'user identity' : 'trait key'
            }`;
            onError &&
                onError({
                    message: errMsg
                });
            throw new Error(errMsg);
        }

        const body = {
            identity: {
                identifier: identity
            },
            trait_key: key,
            trait_value: value
        };

        try {
            await this.getJSON(`${api}/traits/`, 'POST', JSON.stringify(body));
            return await this.getUserIdentity(identity);
        } catch (err) {
            onError && onError({ message: err.message });
            throw err;
        }
    }
};
