import React from 'react';

import { trueOrNull } from './util.js';

export class PatternEntryProps {
    constructor(entryFt, baseFt, finalFt, descentRateMph, gr, hSpeedMph) {
        this.entryFt = entryFt;
        this.baseFt = baseFt;
        this.finalFt = finalFt;
        this.descentRateMph = descentRateMph;
        this.gr = gr;
        if (!gr || gr < 0) {
            this.gr = hSpeedMph / descentRateMph;
        }
    }
}

export function initialPatternEntryProps() {
    const p = localStorage.getItem('patternEntryProps');

    if (p !== null) {
        return JSON.parse(p);
    }

    return new PatternEntryProps(900, 600, 300, 12, 2.6);
}

export class PatternEntryComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            patternEntryProps: initialPatternEntryProps(),
            show: trueOrNull(localStorage.getItem('showPatternEntry'))
        };

        this.load = this.load.bind(this);
    }

    load(ev) {
        ev.preventDefault(); // the form is submitted and reloads the page by default...
        this.props.onChange(this.state.patternEntryProps);
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
                        <button onClick={this.load}>Load as track</button>
                    </p>
                </form>
            </> }
        </div>;
    }
}
