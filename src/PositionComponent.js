import React from 'react';

import { DZ_NONE, dropzones, getCustomDropzones } from './dropzones.js';
import { trueOrNull } from './util.js';

export class PositionProps {
    constructor(dz, offsetE, offsetN, rotation, mirror) {
        this.dz = dz;
        this.offsetE = offsetE;
        this.offsetN = offsetN;
        this.rotation = rotation;
        this.mirror = mirror;
    }
}

export function initialPosition() {
    return new PositionProps(DZ_NONE, 0, 0, 0, false);
}

export class PositionComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            position: initialPosition(),
            show: trueOrNull(localStorage.getItem('showPosition'))
        };

        this.reset = this.reset.bind(this);
    }

    reset() {
        const position = initialPosition();

        this.setState({ position });
        this.props.onChange(position);
    }

    componentDidUpdate() {
        localStorage.setItem('showPosition', JSON.stringify(this.state.show));
    }

    render() {
        const customDropzones = getCustomDropzones();
        const { show } = this.state;
        const { offsetE, offsetN, mirror, rotation } = this.state.position;

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Positioning </b>
            { show && <>
                <br/>
                <form>
                    <p>
                        <label>Move to:</label>
                        <select onChange={ ev => {
                            const position = this.state.position;

                            // TODO also reset winds to avoid stale windsaloft data?
                            position.dz = ev.target.value;
                            this.setState({ position });
                            this.props.onChange(position);

                        }} >
                            <option value={DZ_NONE}>Leave unchanged</option>
                            <option value="Custom:" disabled>Custom:</option>
                            {
                                customDropzones.map(d => <option value={d.name} key={d.name}>{d.name}</option>)
                            }
                            <option value="Included:" disabled>Included:</option>
                            {
                                dropzones.map(d => <option value={d.name} key={d.name}>{d.name}</option>)
                            }
                        </select>
                    </p>
                    <p>
                        <label>Offset N/S:</label>
                        <input type="number" step="5" value={offsetN} onChange={ ev => {
                            const position = this.state.position;

                            position.offsetN = Number(ev.target.value);
                            this.setState({ position });
                            this.props.onChange(position);
                        }} />
                    </p>
                    <p>
                        <label>Offset E/W:</label>
                        <input type="number" step="5" value={offsetE} onChange={ ev => {
                            const position = this.state.position;

                            position.offsetE = Number(ev.target.value);
                            this.setState({ position });
                            this.props.onChange(position);
                        }} />
                    </p>
                    <p>
                        <label>Rotation:</label>
                        <input type="number" step="5" value={rotation} onChange={ ev => {
                            const position = this.state.position;

                            position.rotation = (Number(ev.target.value) + 360) % 360;
                            this.setState({ position });
                            this.props.onChange(position);
                        }} />
                    </p>
                    <p>
                        <label>Mirror:</label>
                        <input type="checkbox" checked={mirror} onChange={ () => {
                            const position = this.state.position;

                            position.mirror = !position.mirror;
                            this.setState({ position });
                            this.props.onChange(position);
                        }} />
                    </p>
                    <p>
                        <button onClick={this.reset}>Reset</button>
                    </p>
                </form>
            </> }
        </div>;
    }
}
