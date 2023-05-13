import * as d3 from 'd3';
import React from 'react';

import { AboutComponent } from './AboutComponent.js';
import { FilesComponent } from './FilesComponent.js';
import MapWithPath from './MapWithPath.js';
import { PositionComponent, initialPosition } from './PositionComponent.js';
import { SettingsComponent, initialSettings } from './SettingsComponent.js';
import { WindsComponent } from './WindsComponent.js';
import { CustomDropzonesComponent, DZ_NONE, dropzones, getCustomDropzones } from './dropzones.js';
import { Path } from './geo.js';
import { WindsAloft } from './windsaloft.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            csv: [],
            path: new Path(),
            winds: new WindsAloft(),
            toggleRerender: false,
            position: initialPosition(),
            settings: initialSettings()
        };

        this.exportFile = this.exportFile.bind(this);
        this.getPaths = this.getPaths.bind(this);
    }

    exportFile() {
        const csv = JSON.parse(JSON.stringify(this.state.csv));
        const path = this.getPaths()[1];
        const len = path.points.length;

        for (let i = 0; i < len; i++) {
            csv[i + 1].lat = path.points[len - i - 1].lat;
            csv[i + 1].lon = path.points[len - i - 1].lng;
        }
        const formatted = d3.csvFormat(csv);

        const link = document.createElement('a');
        const file = new Blob([ formatted ], { type: 'text/csv' });

        link.href = URL.createObjectURL(file);
        link.download = 'track.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    getPaths() {
        const { path, winds, position } = this.state;
        const { dz, mirror, offsetE, offsetN, rotation } = position;
        const newPath = path.copy();

        if (mirror) {
            newPath.mirror();
        }

        if (dz !== DZ_NONE) {
            let dropzone = getCustomDropzones().find(d => d.name === dz);

            if (!dropzone) {
                dropzone = dropzones.find(d => d.name === dz);
            }

            if (dropzone) {
                newPath.translateTo(dropzone);
                if (dropzone.direction) {
                    newPath.setFinalHeading(dropzone.direction);
                }
            } else {
                console.log(`No dropzone: ${dz}`);
            }
        }

        if (offsetN) {
            newPath.translate(0, offsetN);
        }
        if (offsetE) {
            newPath.translate(90, offsetE);
        }
        newPath.rotate(rotation);

        const pathWithWind = newPath.copy();

        pathWithWind.addWind(winds);

        return [ newPath, pathWithWind ];
    }

    render() {
        const { settings } = this.state;
        const paths = this.getPaths();
        let center = dropzones[4]; // Just default somewhere

        if (paths[0].points.length > 0) {
            center = paths[0].points[0];
        }

        if (!settings.showPreWind) {
            paths[0] = new Path();
        }

        const styleLeft = {
            width: '30%',
            float: 'left',
            height: '100%'
        };
        const styleRight = {
            marginLeft: '30%',
            height: '100%'
        };

        return (
            <div style={{ height: window.innerHeight }}>
                <div style={styleLeft}>
                    <hr/>
                    <FilesComponent
                        onChange={ (csv, path) => this.setState({ csv, path }) }
                        exportCallback={ this.exportFile }
                        track={ paths[1] } />
                    <hr/>
                    <PositionComponent onChange={ position => this.setState({ position }) } />
                    <hr/>
                    <WindsComponent
                        center={center}
                        settings={settings}
                        onChange={ winds => this.setState({ winds }) } />
                    <hr/>
                    <CustomDropzonesComponent
                        onChange={() => this.setState({ toggleRerender: !this.state.toggleRerender })} />
                    <hr/>
                    <SettingsComponent onChange={ s => this.setState({ settings: s })} />
                    <hr/>
                    <AboutComponent />
                </div>
                <div style={styleRight}>
                    <MapWithPath center={center} pathA={paths[0]} pathB={paths[1]} showPoms={settings.showPoms}/>
                </div>
            </div>
        );
    }
}

export default App;
