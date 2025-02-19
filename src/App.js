import * as d3 from 'd3';
import React from 'react';

import { AboutComponent } from './AboutComponent.js';
import MapWithPath from './MapWithPath.js';
import { PatternComponent } from './PatternComponent.js';
import { PositionComponent, initialPosition } from './PositionComponent.js';
import { SettingsComponent, initialSettings } from './SettingsComponent.js';
import { WindsComponent } from './WindsComponent.js';
import { CustomDropzonesComponent, DZ_NONE, dropzones, getCustomDropzones } from './dropzones.js';
import { Path } from './util/geo.js';
import { Winds } from './wind.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            csv: [],
            path: new Path(),
            winds: new Winds(),
            toggleRerender: false,
            position: initialPosition(),
            settings: initialSettings(),
            mapClickListener: () => {} // eslint-disable-line no-empty-function
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
        const { interpolateWind } = this.state.settings;
        const { dz, mirror, rotation } = position;
        const newPath = path.copy();

        if (mirror) {
            newPath.mirror();
        }

        newPath.translateTo(dz);
        if (dz.direction) {
            newPath.setFinalHeading(dz.direction);
        }
        newPath.rotate(rotation);

        const pathWithWind = newPath.copy();

        pathWithWind.addWind(winds, interpolateWind);

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
                    <PatternComponent
                        exportCallback={ this.exportFile }
                        paths={ paths }
                        inputType={ this.state.inputType }
                        onPatternChange={ pattern => {
                            console.log("Pattern changed, inputType=" + pattern.inputType);

                            this.setState({csv: pattern.csv, path: pattern.path, inputType: pattern.inputType})
                        }}
                    />
                    <hr/>
                    <PositionComponent
                        onChange={ position => this.setState({ position }) }
                        setMapClickListener={ mapClickListener => this.setState({ mapClickListener }) }
                        onDzChange={() => this.setState({ toggleRerender: !this.state.toggleRerender })}
                    />
                    <hr/>
                    <WindsComponent
                        center={center}
                        settings={settings}
                        onChange={ winds => this.setState({ winds }) } />
                    <hr/>
                    <SettingsComponent onChange={ s => this.setState({ settings: s })} />
                    <hr/>
                    <AboutComponent />
                </div>
                <div style={styleRight}>
                    <MapWithPath
                        center={center}
                        pathA={paths[0]}
                        pathB={paths[1]}
                        showPoms={settings.showPoms}
                        onClick={ point => this.state.mapClickListener(point) }
                    />
                </div>
            </div>
        );
    }
}

export default App;
