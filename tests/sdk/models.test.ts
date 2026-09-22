import { ExperimentMetadata, Flag, Flags } from '../../sdk/models.js';
import { EvaluationResultWithMetadata } from '../../flagsmith-engine/evaluation/models.js';

const isEsmBuild = process.env.ESM_BUILD === 'true';

function apiFlag(overrides: { [key: string]: any } = {}) {
    return {
        feature: { id: 220175, name: 'checkout_cta', type: 'MULTIVARIATE' },
        enabled: true,
        feature_state_value: 'buy-now',
        ...overrides
    };
}

test('fromAPIFlag sets variant, reason and experiment when present', () => {
    const flag = Flag.fromAPIFlag(
        apiFlag({
            variant: 'treatment',
            reason: 'SPLIT; weight=70.0',
            metadata: {
                experiment: { id: 167, name: 'flutter_demo_exp', in_experiment: true }
            }
        })
    );

    expect(flag.featureId).toBe(220175);
    expect(flag.featureName).toBe('checkout_cta');
    expect(flag.value).toBe('buy-now');
    expect(flag.variant).toBe('treatment');
    expect(flag.reason).toBe('SPLIT; weight=70.0');
    expect(flag.experiment).toEqual({
        id: 167,
        name: 'flutter_demo_exp',
        inExperiment: true
    });
});

test('fromAPIFlag leaves variant, reason and experiment undefined when absent', () => {
    const flag = Flag.fromAPIFlag(apiFlag());

    expect(flag.variant).toBeUndefined();
    expect(flag.reason).toBeUndefined();
    expect(flag.experiment).toBeUndefined();
});

test('fromAPIFlag keeps in_experiment false for an identity outside the rollout', () => {
    const flag = Flag.fromAPIFlag(
        apiFlag({
            variant: 'control',
            metadata: { experiment: { id: 167, name: 'flutter_demo_exp', in_experiment: false } }
        })
    );

    expect(flag.variant).toBe('control');
    expect(flag.experiment?.inExperiment).toBe(false);
});

test('fromAPIFlag ignores metadata keys other than experiment', () => {
    const flag = Flag.fromAPIFlag(
        apiFlag({
            metadata: {
                some_other_key: { id: 1 },
                experiment: { id: 167, name: 'flutter_demo_exp', in_experiment: true }
            }
        })
    );

    expect(flag.experiment).toEqual({ id: 167, name: 'flutter_demo_exp', inExperiment: true });
});

test('fromAPIMetadata defaults a missing in_experiment to false', () => {
    const experiment = ExperimentMetadata.fromAPIMetadata({
        experiment: { id: 167, name: 'flutter_demo_exp' }
    });

    expect(experiment).toEqual({ id: 167, name: 'flutter_demo_exp', inExperiment: false });
});

test.each([
    ['undefined metadata', undefined],
    ['null metadata', null],
    ['a non-object metadata', 'experiment'],
    ['metadata without an experiment', { some_other_key: 1 }],
    ['a non-object experiment', { experiment: 'flutter_demo_exp' }],
    ['an experiment without an id', { experiment: { name: 'flutter_demo_exp' } }],
    ['an experiment without a name', { experiment: { id: 167 } }]
])('fromAPIMetadata returns undefined for %s', (_name, metadata) => {
    expect(ExperimentMetadata.fromAPIMetadata(metadata)).toBeUndefined();
});

// Skip in ESM build: instanceof fails across module boundaries
test.skipIf(isEsmBuild)('fromAPIFlag returns a Flag', () => {
    expect(Flag.fromAPIFlag(apiFlag())).toBeInstanceOf(Flag);
});

test('fromEvaluationResult leaves variant and experiment undefined', () => {
    const evaluationResult = {
        flags: {
            some_feature: {
                name: 'some_feature',
                enabled: true,
                value: 'some-value',
                reason: 'DEFAULT',
                metadata: { id: 1 }
            }
        },
        segments: []
    } as unknown as EvaluationResultWithMetadata;

    const flag = Flags.fromEvaluationResult(evaluationResult).getFlag('some_feature') as Flag;

    expect(flag.value).toBe('some-value');
    expect(flag.reason).toBe('DEFAULT');
    expect(flag.variant).toBeUndefined();
    expect(flag.experiment).toBeUndefined();
});
