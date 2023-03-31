import sample450Corrected from './sample-corrected.csv';
import sampleStraightInReduced from './sample-straight-in-reduced.csv';
import sampleStraightIn from './sample-straight-in.csv';
import sample450 from './sample.csv';

export const SAMPLES = [
    {
        name: '[1] Sample 450',
        sample: sample450
    },
    {
        name: '[2] Sample 450, corrected',
        sample: sample450Corrected
    },
    {
        name: '[3] Sample straight-in',
        sample: sampleStraightIn
    },
    {
        name: '[4] Sample straight-in, reduced',
        sample: sampleStraightInReduced
    }
];

export function getSample(name) {
    return SAMPLES.find(s => s.name === name)?.sample;
}
