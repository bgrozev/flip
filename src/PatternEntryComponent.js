import React from 'react';

import { makePattern } from './patterns/pattern.js';
import { extractPathFromCsv } from './util/csv.js';
import { trueOrNull } from './util/util.js';

export class PatternEntryProps {
    constructor(entryFt, baseFt, finalFt, finishFt, descentRateMph, gr, hSpeedMph) {
        this.entryFt = entryFt;
        this.baseFt = baseFt;
        this.finalFt = finalFt;
        this.finishFt = finishFt;
        this.descentRateMph = descentRateMph;
        this.gr = gr;
        if (!gr || gr < 0) {
            this.gr = hSpeedMph / descentRateMph;
        }
        this.zPattern = false;
    }

    static fromLocalStorage(key) {
        const p = localStorage.getItem(key);

        if (p !== null) {
            const j = JSON.parse(p);

            // In case localStorage was set from an older version and some fields are missing.
            if (j) {
                if (j.zPattern === undefined) {
                    j.zPattern = false;
                }
                if (j.finishFt === undefined) {
                    j.finishFt = 0;
                }

                return j;
            }
        }

        return new PatternEntryProps(900, 600, 300, 0, 12, 2.6);
    }
}

export class PatternEntryComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            patternEntryProps: PatternEntryProps.fromLocalStorage('patternEntryProps'),
            show: trueOrNull(localStorage.getItem('showPatternEntry'))
        };

        this.load = this.load.bind(this);
    }

    load(ev) {
        ev.preventDefault(); // the form is submitted and reloads the page by default...

        const props = this.state.patternEntryProps;
        const csv = makePattern(props);

        console.log(`Loading pattern: ${JSON.stringify(props)}`);

        this.props.onChange({ csv, path: extractPathFromCsv(csv), inputType: 'pattern' });
    }

    componentDidUpdate() {
        localStorage.setItem('showPatternEntry', JSON.stringify(this.state.show));
        if (this.state.patternEntryProps !== undefined) {
            localStorage.setItem('patternEntryProps', JSON.stringify(this.state.patternEntryProps));
        }
    }

    render() {
        const { show } = this.state;
        const p = this.state.patternEntryProps;

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Standard Pattern</b>
            { show && <>
                <br/>
                <form>
                    <p>
                    </p>
                    <p>
                        <label>Entry (ft)</label>
                        <input type="number" step="100" value={p.entryFt} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.entryFt = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Turn to base (ft):</label>
                        <input type="number" step="100" value={p.baseFt} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.baseFt = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Turn to final (ft):</label>
                        <input type="number" step="100" value={p.finalFt} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.finalFt = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Finish (ft):</label>
                        <input type="number" step="100" value={p.finishFt} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.finishFt = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Descent rate (mph):</label>
                        <input type="number" step="1" value={p.descentRateMph} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.descentRateMph = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Glide ratio:</label>
                        <input type="number" step="0.1" value={p.gr} onChange={ ev => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.gr = Number(ev.target.value);
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <label>Z-pattern:</label>
                        <input type="checkbox" checked={p.zPattern} onChange={ () => {
                            const patternEntryProps = this.state.patternEntryProps;

                            patternEntryProps.zPattern = !patternEntryProps.zPattern;
                            this.setState({ patternEntryProps });
                        }} />
                    </p>
                    <p>
                        <button onClick={this.load}>Load</button>
                    </p>
                </form>
            </> }
        </div>;
    }
}
