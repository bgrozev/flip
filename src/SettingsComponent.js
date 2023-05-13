import React from 'react';

export function initialSettings() {
    const ds = localStorage.getItem('displaySettings');

    if (ds !== null) {
        return JSON.parse(ds);
    }

    return {
        showPreWind: true,
        showPoms: true,
        useDzGroundWind: true
    };
}
export class SettingsComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            show: localStorage.getItem('showDisplaySettings') === 'true',
            settings: initialSettings()
        };
    }

    componentDidUpdate() {
        localStorage.setItem('showDisplaySettings', JSON.stringify(this.state.show));
        if (this.state.settings !== undefined) {
            localStorage.setItem('displaySettings', JSON.stringify(this.state.settings));
        }
    }

    render() {
        const { show } = this.state;
        const { showPreWind, showPoms, useDzGroundWind } = this.state.settings;

        return <div>
            { show && <img src="hide.png" alt="Hide" width="20" onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src="show.png" alt="Show" width="20" onClick={() => this.setState({ show: !show })}/> }
            <b>Settings</b>
            { show && <>
                <br/>

                <input type="checkbox" checked={showPreWind} onChange={ () => {
                    const settings = this.state.settings;

                    settings.showPreWind = !settings.showPreWind;
                    this.setState({ settings });
                    this.props.onChange(settings);
                }} />
                Display pre-wind adjusted pattern
                <br/>

                <input type="checkbox" checked={showPoms} onChange={ () => {
                    const settings = this.state.settings;

                    settings.showPoms = !settings.showPoms;
                    this.setState({ settings });
                    this.props.onChange(settings);
                }} />
                Display maneuvre points
                <br/>

                <input type="checkbox" checked={useDzGroundWind} onChange={ () => {
                    const settings = this.state.settings;

                    settings.useDzGroundWind = !settings.useDzGroundWind;
                    this.setState({ settings });
                    this.props.onChange(settings);
                }} />
                Use dropzone-specific ground wind
            </> }
        </div>;
    }

}
