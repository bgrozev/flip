import React from 'react';
import Select from 'react-select';

import { DZ_NONE, dropzones, findClosestDropzone, findDropzoneByName, getCustomDropzones } from './dropzones.js';
import { CustomDropzonesComponent } from './dropzones.js';
import { Point } from './geo.js';
import { trueOrNull } from './util.js';

export class PositionProps {
    constructor(dz, rotation, mirror) {
        this.dz = dz;
        this.rotation = rotation;
        this.mirror = mirror;
    }
}

export function initialPosition() {
    const pos = localStorage.getItem('position');

    if (pos !== null) {
        const parsed = JSON.parse(pos);

        // Don't barf on older format saved in local storage.
        if (typeof parsed === 'object' && typeof parsed.dz === 'object') {
            return parsed;
        }
    }

    return new PositionProps(findDropzoneByName('Skydive Spaceland San Marcos'), 0, false);
}

export class PositionComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            position: initialPosition(),
            waitingForClick: false,
            show: trueOrNull(localStorage.getItem('showPosition'))
        };

        this.reset = this.reset.bind(this);
        this.selectFromMap = this.selectFromMap.bind(this);
    }

    reset(ev) {
        const position = initialPosition();

        ev.preventDefault(); // the form is submitted and reloads the page by default...
        this.setState({ position, waitingForClick: false });
        this.props.onChange(position);
    }

    selectFromMap(ev) {
        ev.preventDefault(); // the form is submitted and reloads the page by default...
        this.setState({ waitingForClick: true });
    }

    componentDidUpdate() {
        localStorage.setItem('showPosition', JSON.stringify(this.state.show));
        if (this.state.position !== undefined) {
            localStorage.setItem('position', JSON.stringify(this.state.position));
        }
    }

    componentDidMount() {
        this.props.setMapClickListener(point => {
            if (!this.state.waitingForClick) {
                return;
            }

            const position = this.state.position;

            const dropzone = findClosestDropzone(point);

            position.dz = Object.assign({}, dropzone);
            position.dz.lat = point.lat;
            position.dz.lng = point.lng;
            if (point.distanceTo(new Point(dropzone.lat, dropzone.lng)) > 5280) {
                // Only use ground wind within 1 mi from the dz.
                position.dz.fetchGroundWind = null;
            }

            // TODO also reset winds to avoid stale windsaloft data?
            this.setState({ position, waitingForClick: false });
            this.props.onChange(position);
        });
    }

    render() {
        const customDropzones = getCustomDropzones();
        const { show } = this.state;
        const { mirror, rotation } = this.state.position;
        const unchanged = {
            value: DZ_NONE,
            label: 'Leave unchanged'
        };
        const customLocationsOptions = {
            label: 'Custom Locations',
            options: customDropzones.map(d => {
                return { value: d.name, label: d.name };
            })
        };
        const locationsOptions = {
            label: 'Locations',
            options: dropzones.map(d => {
                return { value: d.name, label: d.name };
            })
        };
        const innerStyle = { marginLeft: '20px' };

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Positioning </b>
            { show && <>
                <br/>
                <label>Move to:</label>
                <Select
                    defaultValue={ unchanged }
                    className="selects"
                    options={[ unchanged, customLocationsOptions, locationsOptions ]}
                    onChange={ ev => {
                        const position = this.state.position;

                        // TODO also reset winds to avoid stale windsaloft data?
                        position.dz = findDropzoneByName(ev.value);
                        this.setState({ position });
                        this.props.onChange(position);
                    }}
                />
                <form>
                    <br/>
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
                    <br/>
                    <button onClick={this.reset}>Reset</button>
                    <button onClick={this.selectFromMap}>Select on map</button>
                </form>
                <hr/>
                <div style={innerStyle}>
                    <CustomDropzonesComponent onChange={this.props.onDzChange} />
                </div>
            </> }
        </div>;
    }
}
