import React from 'react';

import { findClosestDropzone } from './dropzones.js';
import { SOURCE_MANUAL, fetchForecast, forecastSourceLabel } from './forecast/forecast.js';
import { Point } from './util/geo.js';
import { trueOrNull } from './util/util.js';
import { WindRow, Winds } from './wind.js';

export class WindsComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            winds: new Winds(),
            show: trueOrNull(localStorage.getItem('showWinds')),
            fetching: false
        };

        this.addRow = this.addRow.bind(this);
        this.removeRow = this.removeRow.bind(this);

        this.altChanged = this.altChanged.bind(this);
        this.directionChanged = this.directionChanged.bind(this);
        this.speedChanged = this.speedChanged.bind(this);
        this.fetch = this.fetch.bind(this);
        this.reset = this.reset.bind(this);
        this.unlock = this.unlock.bind(this);
    }

    reset() {
        const winds = new Winds([ new WindRow(0, 0, 0) ]);

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

    fetch() {
        const { center } = this.props;

        if (!center) {
            console.log('Not fetching winds, no center');

            return;
        }

        const dz = findClosestDropzone(center);
        const fetchDzGroundWind = this.props.settings.useDzGroundWind && typeof dz.fetchGroundWind === 'function';
        const { forecastSource } = this.props.settings;

        console.log(
            `Fetching winds using ${forecastSource} for: ${JSON.stringify(center)},`
            + ` fetchDzGroundWind=${fetchDzGroundWind} (dz=${dz.name})`
        );

        this.setState({ fetching: true });

        fetchForecast(forecastSource, center, fetchDzGroundWind && dz.fetchGroundWind)
            .then(winds => {
                this.setState({
                    winds,
                    fetching: false
                });
                this.props.onChange(winds);
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
                <i>Ground winds source:</i> { forecastSourceLabel(winds.groundSource) }
                <br/>
                <i>Upper winds source:</i> { forecastSourceLabel(winds.aloftSource) }
                <br/>
                <br/>
                <button onClick={this.fetch}>Fetch forecast</button>
                <button onClick={this.reset}>Reset</button>
                {
                    lock && <button onClick={this.unlock}>Unlock</button>
                }
            </> }
            { fetching && <><br/><i>Fetching forecast...</i></> }
        </div>;
    }
}
