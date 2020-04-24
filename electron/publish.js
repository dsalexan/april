require('dotenv').config()
require('supports-color')

const _ = require('lodash')

const debug = require('../utils/debug').publisher
const file = require('../utils/file')
const delay = require('../utils/delay')

const buildDriver = require('./driver')
const { Builder, By, until } = require('selenium-webdriver')

const notifier = require('node-notifier')

const elements = {
  menuSignIn: 'menu-signin',
  inputEmail: 'email',
  inputPassword: 'password',
  buttonSubmit: 'login',
  userName: "//body[@class='loggedin']//div[@class='profilemeta']//a[@class='userprofile']/div[@class='name']",
  tab: (name) => `//ul[@id='scriptorder']/li/a[text()='${name}.js']`,
  editor: (id) => `div.tab-content div#${id} div.editor.ace_editor`,
  buttonSaveScript: (id, selector = false) =>
    !selector
      ? `//div[@class='tab-content']//div[@id='${id}']//button[contains(@class, 'savescript')]`
      : `div.tab-content div#${id} button.savescript`,
  console: `div#consolepanel div.editor.ace_editor`,
  scriptLibraryTab: "//ul[@id='scriptorder']/li/a[text()='Script Library']",
  buttonRestartSandbox: "//button[contains(@class, 'restartsandbox')]",
  divSandboxReady: 'api-sandbox-ready',
}

var driver
var config = {}
var resetSemaphore = false
var publishingSemaphore = false

async function login() {
  await driver.get(config.CAMPAIGN_SCRIPTS)

  if (!(await isLogged())) {
    debug('Signing in')

    const inputEmail = await driver.findElement(By.id(elements.inputEmail))
    await inputEmail.click()
    await inputEmail.sendKeys(config.EMAIL)

    const inputPassword = await driver.findElement(By.id(elements.inputPassword))
    await inputPassword.click()
    await inputPassword.sendKeys(config.PASSWORD)

    await driver.findElement(By.id(elements.buttonSubmit)).click()

    await driver.wait(until.elementLocated(By.className('loggedin')))
    await driver.get(config.CAMPAIGN_SCRIPTS)
  }

  debug('Signed In')
}

async function isLogged() {
  // const body = await driver.findElement(By.tagName('body'))
  // const bodyClass = await body.getAttribute('class')
  // return bodyClass === 'loggedin'
  try {
    const signIn = await driver.findElement(By.id('signin'))
    const text = await signIn.getAttribute('innerText')
    return Promise.resolve(text.replace(/\s+/gi, '') !== 'SignIn')
  } catch (err) {
    console.log(err)
    Promise.resolve(false)
  }
}

async function updateScript(name) {
  const scriptDebug = debug.get(name.toLowerCase())
  scriptDebug(`Publishing...`)

  const tab = await driver.findElement(By.xpath(elements.tab(name)))
  await tab.click()

  const href = await tab.getAttribute('href')
  const id = href.split('#')[1]
  // const textarea = await driver.findElement(By.xpath(elements.textarea(id)))

  const jsfile = await file.read(`dist/${name}.js`)
  await driver.executeScript(
    'document.querySelector(arguments[0]).env.editor.setValue(arguments[1])',
    elements.editor(id),
    jsfile
  )

  const saveScript = await driver.findElement(By.xpath(elements.buttonSaveScript(id)))
  await saveScript.click()
  return id
}

async function waitForSaving(name) {
  const scriptDebug = debug.get(name.toLowerCase())

  const tab = await driver.findElement(By.xpath(elements.tab(name)))

  const href = await tab.getAttribute('href')
  const id = href.split('#')[1]

  const saveScriptText = (id) =>
    driver.executeScript('return document.querySelector(arguments[0]).innerText', elements.buttonSaveScript(id, true))

  delay(100)
  while ((await saveScriptText(id)) !== 'Save Script') delay(100)

  scriptDebug('Script saved.')
}

async function waitForSandbox() {
  debug('Waiting for sandbox spinning up...')
  let done = false

  await driver.executeScript(
    `
    var _console = document.querySelector(arguments[0]);
    if (!_console.env.editor.__HAS_CHANGE_HOOK__) {
      _console.env.editor.__HAS_CHANGE_HOOK__ = true;
      _console.env.editor.getSession().on('change', function(){
        function removeReady() {
          let header = document.querySelector('body>div.container>div.row>div>h1');
            
          if (header.__HAS_READY_DIV__) {
            header.__HAS_READY_DIV__ = undefined
            header.removeChild(header.lastElementChild)
          }
        }

        let content = _console.env.editor.getValue();

        if (content.match(/Restarting sandbox due to script changes\\.\\.\\..?.?$/)) {
          removeReady()
        } else {
          let currentStartUp = content.split('Previous shutdown complete, starting up...').splice(-1).pop();
          if (currentStartUp) {
            let entries = currentStartUp.split('\\n');
            let done = entries.includes('"Starting webworker script..."') &&
              entries[entries.length - 1] !== '"Starting webworker script..."' &&
              entries[entries.length - 2] !== '"Starting webworker script..."';

            if(done) {
              let header = document.querySelector('body>div.container>div.row>div>h1');

              if (!header.__HAS_READY_DIV__) {
                header.__HAS_READY_DIV__ = true
                let div = document.createElement('div');
                div.className = 'api-sandbox-ready';

                header.appendChild(div);
              }
            } else {
              removeReady()
            }
          } else {
            removeReady()
          }
        }
      });
    }`,
    elements.console
  )

  while (!done) {
    if (resetSemaphore) return false

    delay(100)
    let divReady = await driver.findElements(By.className(elements.divSandboxReady))
    done = divReady.length > 0

    let errorLock = await driver.findElement(By.id('errorlock'))
    if (await errorLock.isDisplayed()) return 'error lock'
  }

  debug('Sandbox ready.')
  return true
}

async function prepare(args) {
  config = args
  driver = await buildDriver()

  await login()

  debug('Accessing API Scripts page of campaign')

  return driver
}

async function publish(scripts) {
  try {
    publishingSemaphore = true

    for (const name of scripts) await updateScript(name)

    await Promise.all(scripts.map(waitForSaving))

    let sandboxReady = await waitForSandbox()
    if (sandboxReady === false) {
      while (!sandboxReady) {
        sandboxReady = await waitForSandbox()
      }
    } else {
      publishingSemaphore = false
      return sandboxReady
    }
  } catch (err) {
    debug('Error', err)
  } finally {
    publishingSemaphore = false
  }
}

async function reset() {
  debug('Reseting API Sandbox...')

  const tab = await driver.findElement(By.xpath(elements.scriptLibraryTab))
  await tab.click()

  await driver.executeScript(`
    (function(){
      let header = document.querySelector('body>div.container>div.row>div>h1');
                
      if (header.__HAS_READY_DIV__) {
        header.__HAS_READY_DIV__ = undefined
        header.removeChild(header.lastElementChild)
      }
    })()`)

  const button = await driver.findElement(By.xpath(elements.buttonRestartSandbox))
  button.click()

  let sandboxReady
  if (publishingSemaphore) resetSemaphore = true
  else sandboxReady = await waitForSandbox()

  debug('API Sandbox reset.')
  return sandboxReady
}

module.exports = {
  publish,
  prepare,
  reset,
}

// // wait and find a specific element with it's id
// this.findById = async function(id) {
//   await this.driver.wait(until.elementLocated(By.id(id)), 15000, 'Looking for element');
//   return await this.driver.findElement(By.id(id));
// };

// // wait and find a specific element with it's name
// this.findByName = async function(name) {
//   await this.driver.wait(until.elementLocated(By.name(name)), 15000, 'Looking for element');
//   return await this.driver.findElement(By.name(name));
// };

// // fill input web elements
// this.write = async function (el, txt) {
//   return await el.sendKeys(txt);
// };

// driver.quit()
