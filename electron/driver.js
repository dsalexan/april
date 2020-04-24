const debug = require('../utils/debug').publisher

const { Builder, Capabilities } = require('selenium-webdriver')

const chrome = require('selenium-webdriver/chrome')

const chromedriver = require('chromedriver')

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build())

async function build() {
  debug('Building driver')

  let o = new chrome.Options()
  // o.addArguments('start-fullscreen');
  o.addArguments('disable-infobars')
  o.addArguments('start-maximized')
  o.addArguments(`user-data-dir=${process.env.CHROME_PROFILE_PATH}`)
  // o.addArguments('headless') // running test on visual chrome browser
  o.setUserPreferences({ credential_enable_service: false })

  const driver = new Builder().setChromeOptions(o).forBrowser('chrome').build()
  await driver.manage().window().setPosition(0, 3000)

  debug('Driver started')

  return driver
}

module.exports = build
