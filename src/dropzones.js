import React from 'react';
import Select from 'react-select';

import { fetchCscGroundWind } from './forecast/csc.js';
import { fetchSdazGroundWind } from './forecast/sdaz.js';
import { fetchSpacelandGroundWind } from './forecast/spaceland.js';
import { Point } from './util/geo.js';

export class Dropzone {
    constructor(name, lat, lng, direction, fetchGroundWind) {
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.direction = direction;
        this.fetchGroundWind = fetchGroundWind;
    }
}

export const DZ_NONE = 'NONE';

export const dropzones = [
    new Dropzone('Chicagoland Skydiving Center', 41.89338, -89.07201, 250, () => fetchCscGroundWind()),
    new Dropzone('Skydive Arizona', 32.80799, -111.58167, 216, () => fetchSdazGroundWind()),
    new Dropzone('Skydive City (ZHills)', 28.21887, -82.15122, 270),
    new Dropzone('Skydive DeLand', 29.06402, -81.27847, 125),
    new Dropzone('Skydive Elsinore', 33.63104, -117.29811, 125),
    new Dropzone('Skydive Midwest', 42.70255, -87.95826, 272),
    new Dropzone('Skydive Paraclete XP', 35.01717, -79.19393, 33),
    new Dropzone('Skydive Sofia (Ihtiman)', 42.42256, 23.76556, 315),
    new Dropzone('Skydive Spaceland Dallas', 33.44727, -96.37722, 2, () => fetchSpacelandGroundWind('DAL')),
    new Dropzone('Skydive Spaceland Houston', 29.357628, -95.461775, 151, () => fetchSpacelandGroundWind('HOU')),
    new Dropzone(
        'Skydive Spaceland San Marcos',
         29.76994,
         -97.77173,
         210,
         () => fetchSpacelandGroundWind('SSM')),
    new Dropzone('West Tennessee Skydiving', 35.22037, -89.18982, 182)
];

export function findClosestDropzone(center) {
    let minDistance = Number.MAX_VALUE;
    let minDz;

    dropzones.forEach(dz => {
        const distance = center.distanceTo(new Point(dz.lat, dz.lng));

        if (distance < minDistance) {
            minDistance = distance;
            minDz = dz;
        }
    });

    return minDz;
}

export function getCustomDropzones() {
    return JSON.parse(localStorage.getItem('customDropzones') ?? '[]');
}

export function findDropzoneByName(name) {
    return getCustomDropzones().find(dz => dz.name === name) ?? dropzones.find(dz => dz.name === name);
}

export class CustomDropzonesComponent extends React.Component {
    constructor(props) {
        super(props);

        const customDropzones = JSON.parse(localStorage.getItem('customDropzones') ?? '[]');
        const selected = customDropzones[0]?.name ?? '';

        this.state = {
            customDropzones,
            name: 'enter name',
            lat: 0,
            lng: 0,
            direction: 0,
            selected,
            show: localStorage.getItem('showCustomDropzones') === 'true'
        };

        this.save = this.save.bind(this);
        this.remove = this.remove.bind(this);
    }

    componentDidUpdate() {
        localStorage.setItem('showCustomDropzones', JSON.stringify(this.state.show));
    }

    save(ev) {
        const { customDropzones } = this.state;

        ev.preventDefault();

        customDropzones.push(new Dropzone(this.state.name, this.state.lat, this.state.lng, this.state.direction));
        localStorage.setItem('customDropzones', JSON.stringify(customDropzones));
        this.setState({ customDropzones });
        this.props.onChange();
    }

    remove() {
        const { selected } = this.state;
        let { customDropzones } = this.state;

        customDropzones = customDropzones.filter(dz => dz.name !== selected);
        localStorage.setItem('customDropzones', JSON.stringify(customDropzones));
        this.setState({ customDropzones });
        this.props.onChange();
    }

    render() {
        const { show } = this.state;
        const options = this.state.customDropzones.map(cd => {
            return { label: cd.name, value: cd.name };
        });
        const def = { label: 'Select location to remove', value: 'Remove', isDisabled: true };

        options.unshift(def);

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Custom Locations </b>
            { show && <>
                <br/>
                <Select
                    className="selects"
                    defaultValue={ def }
                    onChange={ ev => this.setState({ selected: ev.value })} options={options}
                />
                <button onClick={ this.remove }>Remove</button>
                <br/>
                <br/>
                Add new custom location:
                <br/>
                <form>
                    <p>
                        <label>Name:</label>
                        <input type="text" value={ this.state.name }
                            onChange={ ev => this.setState({ name: ev.target.value })}/>
                    </p>
                    <p>
                        <label>Latitude:</label>
                        <input type="number" value={ this.state.lat }
                            onChange={ ev => this.setState({ lat: Number(ev.target.value) })}/>
                    </p>
                    <p>
                        <label>Longitude:</label>
                        <input type="number" value={ this.state.lng }
                            onChange={ev => this.setState({ lng: Number(ev.target.value) })}/>
                    </p>
                    <p>
                        <label>Direction:</label>
                        <input type="number" value={ this.state.direction }
                            onChange={ ev => this.setState({ direction: Number(ev.target.value) }) }/>
                    </p>
                    <p>
                        <button onClick={ this.save }>Save</button>
                    </p>
                </form>
            </> }
        </div>;
    }
}
