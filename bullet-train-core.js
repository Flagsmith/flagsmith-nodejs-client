let fetch;
const BULLET_TRAIN_KEY = "BULLET_TRAIN_DB";

const BulletTrain = class {

    constructor(props) {
        fetch = props.fetch;

        this.getJSON = function (url, method) {
            const { environmentID } = this;
            console.log(url);
            return fetch(url + '?format=json', {
                method: method || 'GET',
                headers: {
                    'x-environment-key': environmentID
                }
            })
                .then(res => res.json());
        };
    }


    getFlagsForUser(identity, self) {
        const { onChange, onError, api, disableCache } = this;

        const handleResponse = (res) => {
            // Handle server response
            let flags = {};
            let userFlags = {};
            res.forEach(feature => {
                if (identity) {
                    if (userFlags[identity] === undefined) {
                        userFlags[identity] = {};
                    }
                    userFlags[identity][feature.feature.name.toLowerCase().replace(/ /g, '_')] = {
                        enabled: feature.enabled,
                        value: feature.feature_state_value
                    };
                }
            });
            return userFlags;
        };

        return this.getJSON(api + 'flags/' + identity)
            .then(res => {
                return handleResponse(res, identity);
            }).then((flags) => {
                return flags[identity];
            }).catch(({ message }) => {
                onError && onError({ message })
            });
    }

    getFlags(self) {
        //Because timer functions get the timeout context we need to pass through the explicit self on timers
        if (self === undefined) {
            self = this;
        }
        const { onChange, onError, api, disableCache } = self;

        const handleResponse = (res) => {
            // Handle server response
            let flags = {};
            res.forEach(feature => {
                flags[feature.feature.name.toLowerCase().replace(/ /g, '_')] = {
                    enabled: feature.enabled,
                    value: feature.feature_state_value
                };
            });
            self.oldFlags = flags;
            self.flags = flags;
            return flags;
        };

        return this.getJSON(api + "flags/")
            .then(res => {
                console.log(res);
                return handleResponse(res);
            }).catch(({ message }) => {
                onError && onError({ message })
            });
    };

    init({
        environmentID,
        api,
        disableCache,
        onError,
        defaultFlags
    }) {

        this.environmentID = environmentID;

        this.api = api;
        this.interval = null;
        this.disableCache = disableCache;
        this.onError = onError;
        this.flags = Object.assign({}, defaultFlags) || {};
        this.initialised = true;

        if (!environmentID) {
            throw ('Please specify a environment id');
        }
        if (api === undefined) {
            this.api = config.api;
        }
        return;
    }

    getAllFlags() {
        return this.flags;
    }

    getValue(key, userId) {
        if (userId) {
            return this.getFlagsForUser(userId).then((flags) => {
                return this.getValueFromFlags(key, flags);
            })
        } else {
            return this.getFlags().then((flags) => {
                return this.getValueFromFlags(key, flags);
            });
        }
    }

    hasFeature(key, userId) {
        if (userId) {
            return this.getFlagsForUser(userId).then((flags) => {
                return this.checkFeatureEnabled(key, flags);
            })
        } else {
            return this.getFlags().then((flags) => {
                return this.checkFeatureEnabled(key, flags);
            });
        }
    }
    getValueFromFlags(key, flags) {
        if (flags === undefined || flags[key] === undefined) {
            return undefined;
        }
        const flag = this.flags[key];
        let res = null;
        if (flag && flag.enabled) {
            res = flag.value;
        }
        //todo record check for value

        return res;
    }

    checkFeatureEnabled(key, flags) {
        if (flags === undefined || flags[key] === undefined) {
            return false;
        }
        const flag = flags[key];
        let res = false;
        if (flag && flag.enabled) {
            res = true;
        }

        return res;
    }
};

module.exports = function ({ fetch }) {
    return new BulletTrain({ fetch });
};