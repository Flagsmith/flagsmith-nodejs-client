# Engine Test Data

This repository contains a single directory containing json files that can be used to test that any Flagsmith engine
written in a given language is correct.

Each JSON file should consist of a single object in the following format.

```json
{
  "environment": {...},  // the environment document as found in DynamoDB
  "identities_and_responses": [
    {
      "identity": {...},  // the identity as found in DynamoDB,
      "response": {...},  // the response that was obtained from the current API
    }
  ]
}
```

To use this data, you will need to write a test case in the repository which contains the engine code and include
this repository as a submodule to get access to the json files.

To add the git submodule:

```bash
git submodule add git@github.com:Flagsmith/engine-test-data.git tests/engine_tests/engine-test-data
```

An example of how to use the test data can be found in the flagsmith-flag-engine repository
[here](https://github.com/Flagsmith/flagsmith-engine/blob/main/tests/engine_tests/test_engine.py).
