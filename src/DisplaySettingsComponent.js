import React from 'react';

export function initialDisplaySettings() {
    const ds = localStorage.getItem('displaySettings');

    if (ds !== null) {
        return JSON.parse(ds);
    }

    return {
        showPreWind: true,
        showPoms: true
    };
}
export class DisplaySettingsComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            show: localStorage.getItem('showDisplaySettings') === 'true',
            displaySettings: initialDisplaySettings()
        };
    }

    componentDidUpdate() {
        localStorage.setItem('showDisplaySettings', JSON.stringify(this.state.show));
        if (this.state.displaySettings !== undefined) {
            localStorage.setItem('displaySettings', JSON.stringify(this.state.displaySettings));
        }
    }

    render() {
        const { show } = this.state;
        const { showPreWind, showPoms } = this.state.displaySettings;

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Display</b>
            { show && <>
                <br/>
                <input type="checkbox" checked={showPreWind} onChange={ () => {
                    const displaySettings = this.state.displaySettings;

                    displaySettings.showPreWind = !displaySettings.showPreWind;
                    this.setState({ displaySettings });
                    this.props.onChange(displaySettings);
                }} />
                Display pre-wind adjusted pattern
                <br/>
                <input type="checkbox" checked={showPoms} onChange={ () => {
                    const displaySettings = this.state.displaySettings;

                    displaySettings.showPoms = !displaySettings.showPoms;
                    this.setState({ displaySettings });
                    this.props.onChange(displaySettings);
                }} />
                Display maneuvre points
            </> }
        </div>;
    }

}
