import React from 'react';

import { findClosestDropzone } from './dropzones.js';
import { Point } from './geo.js';
import { trueOrNull } from './util.js';
import { SOURCE_DZ, SOURCE_MANUAL, SOURCE_WINDS_ALOFT, WindRow, WindsAloft, fetchWindsAloft } from './windsaloft.js';

function sourceText(source) {
    if (source === SOURCE_MANUAL) {
        return 'set manually';
    } else if (source === SOURCE_DZ) {
        return 'dropzone ground wind';
    } else if (source === SOURCE_WINDS_ALOFT) {
        return 'WindsAloft';
    }

    return 'invalid';
}
export class WindsComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            winds: new WindsAloft(),
            show: trueOrNull(localStorage.getItem('showWinds')),
            fetching: false
        };

        this.addRow = this.addRow.bind(this);
        this.removeRow = this.removeRow.bind(this);

        this.altChanged = this.altChanged.bind(this);
        this.directionChanged = this.directionChanged.bind(this);
        this.speedChanged = this.speedChanged.bind(this);
        this.fetchWa = this.fetchWa.bind(this);
        this.reset = this.reset.bind(this);
        this.unlock = this.unlock.bind(this);
    }

    reset() {
        const winds = new WindsAloft([ new WindRow(0, 0, 0) ]);

        this.setState({
            winds,
            show: true
        });
        this.props.onChange(winds);
    }

    addRow() {
        const { winds } = this.state;

        winds.addRow(new WindRow(0, 0, 0));
        this.setState({ winds });
        this.props.onChange(winds);

    }

    removeRow() {
        const { winds } = this.state;

        winds.winds.pop();
        this.setState({ winds });
        this.props.onChange(winds);
    }

    altChanged(i, ev) {
        const value = Number(ev.target.value);
        const { winds } = this.state;

        ev.preventDefault();

        winds.winds[i].altFt = value;
        this.setState({ winds });
        this.props.onChange(winds);
    }

    directionChanged(i, ev) {
        const value = (360 + Number(ev.target.value)) % 360;
        const { winds } = this.state;

        ev.preventDefault();

        winds.winds[i].direction = value;
        this.setState({ winds });
        this.props.onChange(winds);
    }

    speedChanged(i, ev) {
        const value = Number(ev.target.value);
        const { winds } = this.state;

        ev.preventDefault();

        winds.winds[i].speedKts = value;
        this.setState({ winds });
        this.props.onChange(winds);
    }

    unlock() {
        const { winds } = this.state;

        winds.groundSource = SOURCE_MANUAL;
        winds.aloftSource = SOURCE_MANUAL;
        this.setState({ winds });
    }

    fetchWa() {
        const { center } = this.props;

        if (!center) {
            console.log('Not fetching winds, no center');

            return;
        }

        const dz = findClosestDropzone(center);
        const fetchDzGroundWind = typeof dz.fetchGroundWind === 'function';

        console.log(
            `Fetching winds for: ${JSON.stringify(center)}, fetchDzGroundWind=${fetchDzGroundWind} (dz=${dz.name})`);

        this.setState({ fetching: true });

        Promise.all([
            fetchWindsAloft(center, 0),
            fetchDzGroundWind && dz.fetchGroundWind ? dz.fetchGroundWind() : null
        ])
            .then(values => {
                const windsAloft = values[0];
                const groundWind = values[1];

                if (groundWind) {
                    windsAloft.setGroundWind(groundWind);
                    windsAloft.groundSource = SOURCE_DZ;
                }

                this.setState({
                    winds: windsAloft,
                    fetching: false
                });
                this.props.onChange(windsAloft);
            })
            .catch(err => {
                console.log(`Failed to fetch winds: ${err}`);
                this.setState({ fetching: false });
                this.reset();
            });
    }

    // If the center moved to a new location reset the wind to avoid using the wrong forecast.
    componentDidUpdate() {
        const { winds, show } = this.state;
        const usingWindsAloft = winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

        localStorage.setItem('showWinds', show);

        if (usingWindsAloft && winds.center) {
            const newCenter = new Point(this.props.center.lat, this.props.center.lng);
            const distance = newCenter.distanceTo(winds.center);

            if (distance > 2000) {
                console.log(`Disable WindsAloft, because the center moved ${distance} feet.`);
                this.reset();
            }
        }
    }

    render() {
        const { winds, show, fetching } = this.state;
        const self = this;
        const lock = winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

        function renderRow(i) {
            return <tr key={`tr-${i}`}>
                <td>
                    <input type="number" disabled={lock} step="100"
                        value={winds.winds[i].altFt} key={`elev-${i}`}
                        onChange={ev => self.altChanged(i, ev)}/>
                </td>
                <td>
                    <input type="number" disabled={lock} step="5"
                        value={winds.winds[i].direction} key={`direction-${i}`}
                        onChange={ev => self.directionChanged(i, ev)}/>
                </td>
                <td>
                    <input type="number" disabled={lock} value={winds.winds[i].speedKts} key={`speed-${i}`}
                        onChange={ev => self.speedChanged(i, ev)}/>
                </td>
            </tr>;
        }

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Wind </b>
            { show && !fetching && <>
                <table >
                    <thead className='lighter'>
                        <tr>
                            <th key='elev'>Altitude (ft)</th>
                            <th key='direction'>Direction</th>
                            <th key='speed'>Speed (kts)</th>
                        </tr>
                    </thead>
                    <tbody className='windsTable'>
                        {
                            winds.winds.map((x, i) => renderRow(i))
                        }
                    </tbody>
                </table>
                {
                    !lock && <button onClick={this.addRow}>Add row</button>
                }
                {
                    !lock && <button onClick={this.removeRow}>Remove row</button>
                }
                {
                    !lock && <br/>
                }

                <br/>
                <i>Ground winds source:</i> { sourceText(winds.groundSource) }
                <br/>
                <i>Upper winds source:</i> { sourceText(winds.aloftSource) }
                <br/>
                <br/>
                <button onClick={this.fetchWa}>Fetch WindsAloft</button>
                <button onClick={this.reset}>Reset</button>
                {
                    lock && <button onClick={this.unlock}>Unlock</button>
                }
            </> }
            { fetching && <><br/><i>Fetching WindsAloft...</i></> }
        </div>;
    }
}
