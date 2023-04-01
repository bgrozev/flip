import * as d3 from 'd3';
import React from 'react';

import { extractPathFromCsv, trim } from './csv.js';
import { Path } from './geo.js';
import { SAMPLES, getSample } from './samples.js';
import { trueOrNull } from './util.js';

export class FilesComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            autotrim: true,
            csv: [],
            show: trueOrNull(localStorage.getItem('showFiles')),
            path: new Path()
        };

        this.loadSample = this.loadSample.bind(this);
        this.loadFile = this.loadFile.bind(this);
    }

    componentDidMount() {
        this.loadSample(SAMPLES[0].name);
    }

    componentDidUpdate() {
        localStorage.setItem('showFiles', JSON.stringify(this.state.show));
    }

    loadSample(name) {
        const s = getSample(name);
        const self = this;

        console.log(`Loading sample ${name}`);

        if (!s) {
            const path = new Path();
            const csv = [];

            self.setState({ csv, path });
            self.props.onChange(csv, path);

            return;
        }

        d3.csv(s).then(csv => {
            console.log(`Loaded ${csv.length}`);

            const path = extractPathFromCsv(csv);

            self.setState({ path, csv });
            self.props.onChange(csv, path);
        });
    }

    loadFile(f) {
        console.log(`Loading ${f}`);
        const self = this;

        f.text().then(data => {
            const csv = d3.csvParse(data);

            if (self.state.autotrim) {
                trim(csv, 2500);
            }

            const path = extractPathFromCsv(csv);

            self.setState({ csv, path });
            this.props.onChange(csv, path);
        });
    }


    render() {
        const { show } = this.state;

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Tracks</b>
            { show && <>
                <br/>
                Select track:
                <select onChange={ ev => {
                    this.loadSample(ev.target.value);
                }}>
                    <option value="Custom tracks:" disabled>Custom tracks:</option>
                    <option value="Sample tracks:" disabled>Sample tracks:</option>
                    {
                        SAMPLES.map(d => <option value={d.name} key={d.name}>{d.name}</option>)
                    }
                </select>
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
            </>
            }
        </div>;
    }
}
