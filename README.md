<img width="100%" src="./hero.png"/>

# Bullet Train Client
[![Gitter](https://img.shields.io/gitter/room/gitterHQ/gitter.svg)](https://gitter.im/SolidStateGroup/bullettrain?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![npm version](https://badge.fury.io/js/bullet-train-client.svg)](https://badge.fury.io/js/bullet-train-client)
[![](https://data.jsdelivr.com/v1/package/npm/bullet-train-client/badge)](https://www.jsdelivr.com/package/npm/bullet-train-client)

The SDK clients for web and React Native for [https://bullet-train.io/](https://www.bullet-train.io/). Bullet Train allows you to manage feature flags and remote config across multiple projects, environments and organisations.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See running in production for notes on how to deploy the project on a live system.

## Installing

### VIA npm
```npm i bullet-train-client --save```
	
## Usage
**Retrieving feature flags for your project**

**For full documentation visit [https://bullet-train.io/documentation](https://www.bullet-train.io/documentation)**
```javascript
var bulletTrain = require("bullet-train-nodejs");

bulletTrain.init({
	environmentID:"<YOUR_ENVIRONMENT_KEY>"
	}
});


bulletTrain.hasFeature("header", '<My User Id>')
.then((featureEnabled) => {
	if (featureEnabled) {
		//Show my awesome cool new feature to this one user
	}
});
bulletTrain.hasFeature("header")
.then((featureEnabled) => {
	if (featureEnabled) {
		//Show my awesome cool new feature to the world
	}
});

bulletTrain.getValue("header", '<My User Id')
.then((value) => {
	//Show some unique value to this user
});

bulletTrain.getValue("header")
.then((value) => {
	//Show a value to the world
});
```
**Available Options**

| Property        | Description           | Required  | Default Value  |
| ------------- |:-------------:| -----:| -----:|
| ```environmentID```     | Defines which project environment you wish to get flags for. *example ACME Project - Staging.* | **YES** | null
| ```onError```     | Callback function on failure to retrieve flags. ``` (error)=>{...} ``` | | null
| ```defaultFlags```     | Callback function on failure to retrieve flags. ``` (error)=>{...} ``` | | null
| ```api```     | Use this property to define where you're getting feature flags from, e.g. if you're self hosting. |  https://featureflagger.3qqe.flynnhub.com/api/

**Identifying users**

Identifying users allows you to target specific users from the [Bullet Train dashboard](https://www.bullet-train.io/).
You can include an optional user identifier as part of the `hasFeature` and `getValue` methods to retrieve unique user flags and variables.


## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/kyle-ssg/c36a03aebe492e45cbd3eefb21cb0486) for details on our code of conduct, and the process for submitting pull requests to us.

## Getting Help

If you encounter a bug or feature request we would like to hear about it. Before you submit an issue please search existing issues in order to prevent duplicates. 

## Get in touch

If you have any questions about our projects you can email <a href="mailto:projects@solidstategroup.com">projects@solidstategroup.com</a>.
