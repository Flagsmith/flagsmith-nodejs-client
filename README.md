<img width="100%" src="https://raw.githubusercontent.com/SolidStateGroup/bullet-train-frontend/master/hero.png"/>

# Flagsmith Client

[![npm version](https://badge.fury.io/js/flagsmith-nodejs.svg)](https://badge.fury.io/js/flagsmith-nodejs)
[![](https://data.jsdelivr.com/v1/package/npm/flagsmith-nodejs/badge)](https://www.jsdelivr.com/package/npm/flagsmith-nodejs)

The SDK clients for NodeJS [https://bullet-train.io/](https://www.bullet-train.io/). Flagsmith allows you to manage feature flags and remote config across multiple projects, environments and organisations.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See running in production for notes on how to deploy the project on a live system.

## Installing

### VIA npm

```npm i flagsmith-nodejs --save```

## Usage

### Retrieving feature flags for your project

*For full documentation visit [https://docs.bullet-train.io](https://docs.bullet-train.io)*

```javascript
var flagsmith = require("flagsmith-nodejs");

flagsmith.init({
    environmentID:"<YOUR_ENVIRONMENT_KEY>"
});

flagsmith.hasFeature("header", '<My User Id>')
.then((featureEnabled) => {
    if (featureEnabled) {
        //Show my awesome cool new feature to this one user
    }
});
flagsmith.hasFeature("header")
.then((featureEnabled) => {
    if (featureEnabled) {
        //Show my awesome cool new feature to the world
    }
});

flagsmith.getValue("header", '<My User Id>')
.then((value) => {
    //Show some unique value to this user
});

flagsmith.getValue("header")
.then((value) => {
    //Show a value to the world
});
```

### Available Options

| Property        | Description           | Required  | Default Value  |
| ------------- |:-------------:| -----:| -----:|
| ```environmentID```     | Defines which project environment you wish to get flags for. *example ACME Project - Staging.* | **YES** | null
| ```onError```     | Callback function on failure to retrieve flags. ``` (error)=>{...} ``` |  **NO** | null
| ```defaultFlags```     | Defines the default flags if there are any | **NO** | null
| ```api```     | Use this property to define where you're getting feature flags from, e.g. if you're self hosting. |  **NO** | https://bullet-train-api.dokku1.solidstategroup.com/api/v1/

### Available Functions

| Property        | Description |
| ------------- |:-------------:|
| ```init```     | Initialise the sdk against a particular environment
| ```hasFeature(key)```     | Get the value of a particular feature e.g. ```flagsmith.hasFeature("powerUserFeature") // true```
| ```hasFeature(key, userId)```     | Get the value of a particular feature for a user e.g. ```flagsmith.hasFeature("powerUserFeature", 1234) // true```
| ```getValue(key)```     | Get the value of a particular feature e.g. ```flagsmith.getValue("font_size") // 10```
| ```getValue(key, userId)```     | Get the value of a particular feature for a specificed userId e.g. ```flagsmith.getValue("font_size", 1234) // 15```
| ```getFlags()```     | Trigger a manual fetch of the environment features, if a user is identified it will fetch their features
| ```getFlagsForUser(userId)```     | Trigger a manual fetch of the environment features with a given userId
| ```setTrait(userId, key, value)```     | Set the name/value pair for the specified userId
| ```getTrait(userId, key)```     | Retrieve the value for the specified userId and Trait key

### Identifying users

Identifying users allows you to target specific users from the [Flagsmith dashboard](https://www.bullet-train.io/).
You can include an optional user identifier as part of the `hasFeature` and `getValue` methods to retrieve unique user flags and variables.

## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/kyle-ssg/c36a03aebe492e45cbd3eefb21cb0486) for details on our code of conduct, and the process for submitting pull requests to us.

## Getting Help

If you encounter a bug or feature request we would like to hear about it. Before you submit an issue please search existing issues in order to prevent duplicates.

## Get in touch

If you have any questions about our projects you can email <a href="mailto:support@bullet-train.io">support@bullet-train.io</a>.

## Useful links

[Website](https://bullet-train.io)

[Documentation](https://docs.bullet-train.io/)

[Code Examples](https://github.com/flagsmithHQ/bullet-train-docs)

[Youtube Tutorials](https://www.youtube.com/channel/UCki7GZrOdZZcsV9rAIRchCw)
