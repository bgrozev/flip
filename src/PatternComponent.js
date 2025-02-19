import React from 'react';

import { FilesComponent } from './FilesComponent.js';
import { PatternEntryComponent } from './PatternEntryComponent.js';
import { trueOrNull } from './util/util.js';

export class PatternComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            show: trueOrNull(localStorage.getItem('showPattern'))
        };
    }

    componentDidUpdate() {
        localStorage.setItem('showPattern', JSON.stringify(this.state.show));
    }

    render() {
        const { show } = this.state;
        const innerStyle = { marginLeft: '20px' };

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Pattern</b>
            { show && <>
                <hr/>
                <div style={innerStyle}>
                    <FilesComponent
                        onChange={ (csv, path) => this.props.onPatternChange({csv, path, inputType: "file" })}
                        exportCallback={this.props.exportCallback}
                        track={this.props.paths[1]}
                    />
                    <hr/>
                    <PatternEntryComponent onChange={this.props.onPatternChange} />
                </div>
            </>
            }
        </div>;
    }
}
