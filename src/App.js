import React from 'react'
import logo from './logo.svg'
import './App.css'

import { makeStyles, createMuiTheme, ThemeProvider } from '@material-ui/core/styles'

import Button from '@material-ui/core/Button'
import Checkbox from '@material-ui/core/Checkbox'
import FormControlLabel from '@material-ui/core/FormControlLabel'

import pink from '@material-ui/core/colors/pink'
import blue from '@material-ui/core/colors/blue'
import red from '@material-ui/core/colors/red'
import amber from '@material-ui/core/colors/amber'
import green from '@material-ui/core/colors/green'

const { ipcRenderer, remote, shell } = window.require ? window.require('electron') : {}
const fs = window.require && window.require('fs')
const path = window.require && window.require('path')
const app = remote && remote.app

var Notification = window.Notification || window.mozNotification || window.webkitNotification

const theme = createMuiTheme({
  palette: {
    primary: pink,
    secondary: blue,
    error: red,
    warning: amber,
    success: green,
  },
  overrides: {
    MuiCheckbox: {
      root: {
        color: '#5e5e5e',
      },
    },
  },
})

const useStyles = makeStyles((theme) => ({
  // E9068E
  gradient: {
    background: 'linear-gradient(45deg, #b021ba 30%, #E9068E 90%)',
    border: 0,
    borderRadius: 3,
    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
    color: 'white',
    height: 48,
    padding: '0 30px',
  },
}))

function useStickyState(defaultValue, key) {
  const [value, setValue] = React.useState(() => {
    const stickyValue = window.localStorage.getItem(key)
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue
  })

  React.useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

function getScripts() {
  const directory = remote.process.env.NODE_ENV === 'development' ? './../dist/' : './'
  return fs.readdirSync(path.join(app.getAppPath(), directory)).filter((file) => path.extname(file) === '.js')
}

function App() {
  const classes = useStyles()

  const scriptFiles = getScripts().map((file) => file.replace(/\.js$/, ''))

  const [state, setState] = useStickyState(
    scriptFiles.reduce((obj, cur) => ({ ...obj, [cur]: true }), {}),
    '@core/scripts'
  )

  const handleChange = (event) => {
    setState({ ...state, [event.target.name]: event.target.checked })
  }

  const handleClick = (event) => {
    ipcRenderer &&
      ipcRenderer.send(
        '@april/publish',
        Object.keys(state)
          .filter((key) => state[key])
          .map((key) => key)
      )
  }

  var prepared = false
  if (ipcRenderer) {
    ipcRenderer.on('@april/notify', (event, message) => {
      new Notification('April', {
        body: message,
      })
    })

    ipcRenderer.on('@april/prepared', (event) => {
      prepared = true
    })
  }

  const handleClickPrepare = (event) => {
    ipcRenderer && ipcRenderer.send('@april/prepare')
  }

  const handleClickReset = (event) => {
    ipcRenderer && ipcRenderer.send('@april/reset')
  }

  const handleClickCancel = (event) => {
    ipcRenderer && ipcRenderer.send('@april/cancel')
  }
  const handleClickRoll20 = (event) => {
    shell.openExternal(
      event === 'home'
        ? 'https://roll20.net/'
        : event === 'api'
        ? 'https://app.roll20.net/campaigns/scripts/6446329'
        : 'https://docs.google.com/spreadsheets/d/1TFfWls7t2McM4gfPhn1m-NWddpo0Sb8TWGClTLawueM/edit#gid=0'
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="App">
        <header className="App-header">
          {/* <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a> */}
          <h3>Scripts</h3>
          <div className="scripts">
            {Object.values(scriptFiles).map((name, index) => (
              <div key={index}>
                <FormControlLabel
                  control={<Checkbox checked={state[name]} onChange={handleChange} name={name} color="primary" />}
                  label={name}
                />
              </div>
            ))}
          </div>
          <br />
          <div className="buttons">
            <Button variant="contained" color="primary" onClick={() => handleClickRoll20('home')}>
              Roll20
            </Button>
            <br />
            <Button variant="contained" color="primary" onClick={() => handleClickRoll20('api')}>
              Campaign API Scripts
            </Button>
            <br />
            <Button variant="contained" color="green" onClick={() => handleClickRoll20('soundboard')}>
              Soundboard
            </Button>
            <br />
            <br />
            <Button variant="contained" color="secondary" onClick={handleClickPrepare}>
              Prepare
            </Button>
            <br />
            <Button variant="contained" color="secondary" onClick={handleClickReset}>
              Reset API Sandbox
            </Button>
            <br />

            <Button className={classes.gradient} variant="contained" color="primary" onClick={handleClick}>
              Publish
            </Button>
            <br />

            <Button variant="contained" color="error" onClick={handleClickCancel}>
              Close
            </Button>
          </div>
        </header>
      </div>
    </ThemeProvider>
  )
}

export default App
