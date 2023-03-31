import React from 'react';

import { Point } from './geo.js';
import { trueOrNull } from './util.js';
import { WindRow, WindsAloft, fetchWindsAloft } from './windsaloft.js';

export class WindsComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            winds: new WindsAloft(),
            show: trueOrNull(localStorage.getItem('showWinds')),
            usingWindsAloft: false,
            fetching: false
        };

        this.addRow = this.addRow.bind(this);
        this.removeRow = this.removeRow.bind(this);

        this.altChanged = this.altChanged.bind(this);
        this.directionChanged = this.directionChanged.bind(this);
        this.speedChanged = this.speedChanged.bind(this);
        this.fetchWa = this.fetchWa.bind(this);
        this.reset = this.reset.bind(this);
    }

    reset() {
        const winds = new WindsAloft([ new WindRow(0, 0, 0) ]);

        this.setState({
            winds,
            show: true,
            usingWindsAloft: false
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

    fetchWa() {
        const { center } = this.props;

        if (!center) {
            console.log('Not fetching winds, no center');

            return;
        }

        this.setState({ fetching: true });
        console.log(`Fetching winds for: ${JSON.stringify(center)}`);
        fetchWindsAloft(center, 0)
            .then(winds => {
                this.setState({
                    winds,
                    usingWindsAloft: true,
                    fetching: false
                });
                this.props.onChange(winds);
            })
            .catch(err => console.log(`Failed to fetch WindsAloft: ${err}`));
    }

    componentDidUpdate() {
        const { winds, usingWindsAloft, show } = this.state;

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
        const { winds, usingWindsAloft, show, fetching } = this.state;
        const self = this;

        function renderRow(i) {
            return <tr key={`tr-${i}`}>
                <td>
                    <input type="number" disabled={usingWindsAloft} step="100"
                        value={winds.winds[i].altFt} key={`elev-${i}`}
                        onChange={ev => self.altChanged(i, ev)}/>
                </td>
                <td>
                    <input type="number" disabled={usingWindsAloft} step="5"
                        value={winds.winds[i].direction} key={`direction-${i}`}
                        onChange={ev => self.directionChanged(i, ev)}/>
                </td>
                <td>
                    <input type="number" disabled={usingWindsAloft} value={winds.winds[i].speedKts} key={`speed-${i}`}
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
                    !usingWindsAloft && <button onClick={this.addRow}>Add row</button>
                }
                {
                    !usingWindsAloft && <button onClick={this.removeRow}>Remove row</button>
                }

                <br/>
                <br/>
                <button onClick={this.fetchWa}>Fetch WindsAloft</button>
                <button onClick={this.reset}>Reset</button>
                {
                    usingWindsAloft && <button onClick={() => this.setState({ usingWindsAloft: false })}>Unlock</button>
                }
            </> }
            { fetching && <><br/><i>Fetching WindsAloft...</i></> }
        </div>;
    }
}
