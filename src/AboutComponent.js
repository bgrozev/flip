import React from 'react';

export class AboutComponent extends React.Component {
    constructor(props) {
        super(props);

        this.state = { show: false };
    }

    render() {
        const { show } = this.state;

        return <div>
            { show && <img src='hide.png' alt='Hide' width='20' onClick={() => this.setState({ show: !show })}/> }
            { !show && <img src='show.png' alt='Show' width='20' onClick={() => this.setState({ show: !show })}/> }
            <b>About</b>
            { show && <>
                <br/>
                <br/>
                <text style={{ fontSize: '70%' }}>
                    <a href='https://github.com/bgrozev/flip'>FliP Flight Planner</a> by Boris Grozev, for documentation
                    see the <a href='https://github.com/bgrozev/flip/blob/main/README.md'>README</a> and
                    this <a href='https://youtu.be/G8TQtR7Qd8o'>introduction video</a>.
                </text>
                <br/>
                <br/>
                <text style={{ fontSize: '70%' }}>
                    Powered by <a href = "https://flysight.ca/">FlySight</a>.
                </text>
                <br/>
                <text style={{ fontSize: '70%' }}>
                    Winds forecast from <a href = 'https://www.markschulze.net/winds/'>Winds Aloft by Mark Schulze</a>
                    &nbsp;and <a href = 'https://open-meteo.com/'>OpenMeteo</a>
                </text>
                <br/>
                <text style={{ fontSize: '70%' }}>
                    Ground winds from: <a href='https://sanmarcosclock.skydivespaceland.com/'>Spaceland Load
                    Clock</a>, <a href='https://wx.skydivecsc.com/'>CSC Weather</a>, <a
                        href='https://axis.tools/tool_Cond.php'>AXIS Tools</a>.
                </text>
            </>
            }
        </div>;
    }
}
