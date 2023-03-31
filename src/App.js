import * as d3 from 'd3';
import React from 'react';

import { AboutComponent } from './AboutComponent.js';
import { DisplaySettingsComponent, initialDisplaySettings } from './DisplaySettingsComponent.js';
import { FilesComponent } from './FilesComponent.js';
import MapWithPath from './MapWithPath.js';
import { PositionComponent, initialPosition } from './PositionComponent.js';
import { WindsComponent } from './WindsComponent.js';
import { extractPathFromCsv } from './csv.js';
import { CustomDropzonesComponent, DZ_NONE, dropzones, getCustomDropzones } from './dropzones.js';
import { Path } from './geo.js';
import { WindsAloft } from './windsaloft.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            csv: [],
            winds: new WindsAloft(),
            toggleRerender: false,
            position: initialPosition(),
            displaySettings: initialDisplaySettings()
        };

        this.exportFile = this.exportFile.bind(this);
        this.getPaths = this.getPaths.bind(this);
    }

    exportFile() {
        const csv = JSON.parse(JSON.stringify(this.state.csv));
        const newPath = this.getPaths().path2;
        const len = newPath.points.length;

        for (let i = 0; i < len; i++) {
            csv[i + 1].lat = newPath.points[len - i - 1].lat;
            csv[i + 1].lon = newPath.points[len - i - 1].lng;
        }
        const formatted = d3.csvFormat(csv);

        const link = document.createElement('a');
        const file = new Blob([ formatted ], { type: 'text/csv' });

        link.href = URL.createObjectURL(file);
        link.download = 'sample.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    getPaths() {
        // TODO: we're re-calculating on every render. Save the paths in state and only update them when necessary?
        const { csv, winds, position } = this.state;
        const { dz, mirror, offsetE, offsetN, rotation } = position;
        const path = extractPathFromCsv(csv);

        if (mirror) {
            path.mirror();
        }

        if (dz !== DZ_NONE) {
            let dropzone = getCustomDropzones().find(d => d.name === dz);

            if (!dropzone) {
                dropzone = dropzones.find(d => d.name === dz);
            }

            if (dropzone) {
                path.translateTo(dropzone);
                if (dropzone.direction) {
                    path.setFinalHeading(dropzone.direction);
                }
            } else {
                console.log(`No dropzone: ${dz}`);
            }
        }

        if (offsetN) {
            path.translate(0, offsetN);
        }
        if (offsetE) {
            path.translate(90, offsetE);
        }
        path.rotate(rotation);

        const pathWithWind = path.copy();

        pathWithWind.addWind(winds);

        let center = dropzones[4]; // Just somewhere as it's required

        if (path.points.length > 0) {
            center = path.points[0];
        }

        return {
            center,
            path,
            path2: pathWithWind
        };
    }

    render() {
        const { showPreWind, showPoms } = this.state.displaySettings;
        const paths = this.getPaths();

        if (!showPreWind) {
            paths.path = new Path();
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
                    <FilesComponent onChange={ csv => this.setState({ csv }) } exportCallback={ this.exportFile }/>
                    <hr/>
                    <PositionComponent onChange={ position => this.setState({ position }) } />
                    <hr/>
                    <WindsComponent center={paths.center} onChange={ winds => this.setState({ winds }) } />
                    <hr/>
                    <CustomDropzonesComponent
                        onChange={() => this.setState({ toggleRerender: !this.state.toggleRerender })} />
                    <hr/>
                    <DisplaySettingsComponent onChange={ displaySettings => this.setState({ displaySettings })} />
                    <hr/>
                    <AboutComponent />
                </div>
                <div style={styleRight}>
                    <MapWithPath center={paths.center} pathA={paths.path} pathB={paths.path2} showPoms={showPoms}/>
                </div>
            </div>
        );
    }
}

export default App;
