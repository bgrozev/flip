import * as d3 from 'd3';
import React from 'react';
import Select from 'react-select';

import { SAMPLES, getSample } from './samples/samples.js';
import { convertFromGnss, extractPathFromCsv, trim } from './util/csv.js';
import { Path } from './util/geo.js';
import { parseFromLocalStorage, trueOrNull } from './util/util.js';

export class FilesComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            autotrim: false,
            csv: [],
            currentTrackName: '',
            customTracks: parseFromLocalStorage('customTracks', []),
            name: 'Track name',
            path: new Path(),
            show: trueOrNull(localStorage.getItem('showFiles'))
        };

        this.loadSample = this.loadSample.bind(this);
        this.loadCustomTrack = this.loadCustomTrack.bind(this);
        this.loadFile = this.loadFile.bind(this);
        this.save = this.save.bind(this);
        this.remove = this.remove.bind(this);
    }

    componentDidMount() {
        const { customTracks } = this.state;

        if (customTracks.length > 0) {
            this.loadCustomTrack(customTracks[0].name);
        } else {
            this.loadSample(SAMPLES[0].name);
        }
    }

    componentDidUpdate() {
        localStorage.setItem('showFiles', JSON.stringify(this.state.show));
        localStorage.setItem('customTracks', JSON.stringify(this.state.customTracks));
    }

    loadCustomTrack(name) {
        const { customTracks } = this.state;
        const self = this;

        console.log(`Loading custom track: ${name}`);
        const customTrack = customTracks.find(t => t.name === name);

        if (!customTrack) {
            console.log(`No custom track with name ${name}`);

            return false;
        }

        const csv = d3.csvParse(customTrack.csv);
        const path = extractPathFromCsv(csv);

        console.log(`Loaded custom track with length ${csv.length}`);

        self.setState({ csv, path, currentTrackName: name });
        self.props.onChange(csv, path);

        return true;
    }

    loadSample(name) {
        // We use loadSample() to load either a sample or a custom track. Try a custom track first.
        if (this.loadCustomTrack(name)) {
            return;
        }

        console.log(`Loading sample ${name}.`);
        const sample = getSample(name);
        const self = this;

        if (!sample) {
            console.log('No sample loaded.');

            return;
        }

        d3.csv(sample).then(csv => {
            const path = extractPathFromCsv(csv);

            console.log(`Loaded sample with length ${csv.length}`);

            self.setState({ path, csv, currentTrackName: name });
            self.props.onChange(csv, path);
        });
    }

    loadFile(f) {
        console.log(`Loading ${f}`);
        const self = this;

        f.text().then(data => {
            const converted = convertFromGnss(data);
            const csv = d3.csvParse(converted);

            if (self.state.autotrim) {
                console.log('Using autotrim to 2500 ft.');
                trim(csv, 2500);
            }

            const path = extractPathFromCsv(csv);

            self.setState({ csv, path, currentTrackName: '' });
            this.props.onChange(csv, path);
        });
    }

    save() {
        const path = this.props.track;
        const { csv, name, customTracks } = this.state;
        const csvCopy = JSON.parse(JSON.stringify(csv));
        const len = path.points.length;

        for (let i = 0; i < len; i++) {
            csvCopy[i + 1].lat = path.points[len - i - 1].lat;
            csvCopy[i + 1].lon = path.points[len - i - 1].lng;
        }
        const formatted = d3.csvFormat(csvCopy);

        console.log(`Saving custom track as ${name}`);
        customTracks.push({ name, csv: formatted });

        this.setState({ customTracks });
    }

    remove() {
        let { customTracks, currentTrackName } = this.state;

        if (currentTrackName) {
            customTracks = customTracks.filter(t => t.name !== currentTrackName);
            currentTrackName = '';

            this.setState({ customTracks, currentTrackName });
        }
    }

    render() {
        const { show, currentTrackName } = this.state;
        const trackOptions = {
            label: 'Custom Tracks',
            options: this.state.customTracks.map(t => {
                return { value: t.name, label: t.name };
            })
        };
        const sampleOptions = {
            label: 'Samples',
            options: SAMPLES.map(t => {
                return { value: t.name, label: t.name };
            })
        };
        let def = trackOptions.options.find(o => o.value === currentTrackName);

        if (!def) {
            def = sampleOptions.options.find(o => o.value === currentTrackName);
        }

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Tracks</b>
            { show && <>
                <br/>
                Select track:
                <Select className="selects" options={[ trackOptions, sampleOptions ]} value={def} onChange={ ev => {
                    this.loadSample(ev.value);
                }} />
                <br/>
                <br/>
                Load track from CSV file (
                <input type="checkbox" checked={this.state.autotrim}
                    onChange={() => this.setState({ autotrim: !this.state.autotrim }) }/>
                <small style={{ fontSize: '70%' }}>Use autotrim (experimental)</small>)
                <input type="file" onChange={e => this.loadFile(e.target.files[0])}/>
                <br/>
                <br/>

                Export current track to CSV file: <button onClick={ this.props.exportCallback }>Export</button>
                <br/>
                <br/>

                Remove selected track:
                <button onClick={ this.remove }>Remove</button>
                <br/>
                Save current track:
                <input type="text" value={ this.state.name }
                    onChange={ ev => this.setState({ name: ev.target.value })}/>
                <button onClick={ this.save }>Save</button>
            </>
            }
        </div>;
    }
}
