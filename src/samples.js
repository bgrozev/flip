import sample450Corrected from './sample-corrected.csv';
import samplePattern from './sample-pattern.csv';
import sample450 from './sample.csv';

export const SAMPLES = [
    {
        name: '[1] 900-600-300 ft, 2.6 glide, 10 mph descent',
        sample: samplePattern
    },
    {
        name: '[2] Sample 450',
        sample: sample450
    },
    {
        name: '[3] Sample 450, corrected',
        sample: sample450Corrected
    }
];

export function getSample(name) {
    return SAMPLES.find(s => s.name === name)?.sample;
}
