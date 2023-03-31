import * as d3 from 'd3';
import React from 'react';

import { trim } from './csv.js';
import { SAMPLES, getSample } from './samples.js';
import { trueOrNull } from './util.js';

export class FilesComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            autotrim: true,
            csv: [],
            show: trueOrNull(localStorage.getItem('showFiles'))
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
            self.setState({ csv: [] });
            self.props.onChange([]);

            return;
        }

        d3.csv(s).then(csv => {
            console.log(`Loaded ${csv.length}`);
            self.setState({ csv });
            self.props.onChange(csv);
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
            self.setState({ csv });
            this.props.onChange(csv);
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
                    onChange={() => this.setState({ autotrim: !this.state.autotrim }) }/>Use autotrim)
                <input type="file" onChange={e => this.loadFile(e.target.files[0])}/>
                <br/>
                <br/>

                Export current track to CSV file: <button onClick={ this.props.exportCallback }>Export</button>
            </>
            }
        </div>;
    }
}
