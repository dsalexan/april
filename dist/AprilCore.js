/* eslint-disable prefer-destructuring */
/* global on, log, _, state, sendChat, getObj, findObjs, Campaign, sendPing, getAttrByName, createObj,playerIsGM */

var aprilCore = (function () {
  var version = '0.0.1',
    schemaVersion = '0.0.1',
    sheetVersion = '5th Edition OGL by Roll20 2.0'

  // HELPERS
  var escapeURI = function (text) {
    try {
      return decodeURIComponent(text)
    } catch (err) {
      return unescape(text)
    }
  }

  var actionName = function (name) {
    return name
      .replace(/[\s:=|()-]+/gi, '-')
      .replace(/[\.\n]+$/, '')
      .replace(/^\n+/, '')
  }
  var makeid = function (length) {
    var result = ''
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    var charactersLength = characters.length
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }

  var isNpc = function (id) {
    var checkNpc = findObjs({ _type: 'attribute', _characterid: id, name: 'npc' })
    if (_.isUndefined(checkNpc[0])) {
      return false
    } else {
      return checkNpc[0].get('current')
    }
  }

  // SELECTED
  var getSelectedCharacters = function (selected) {
    return _.chain(selected)
      .map(function (s) {
        return getObj(s._type, s._id)
      })
      .reject(_.isUndefined)
      .map(function (c) {
        return getObj('character', c.get('represents'))
      })
      .filter(_.identity)
      .value()
  }

  var getSelectedTokens = function (selected) {
    return selected.map((s) => getObj(s._type, s._id))
  }

  // PAGE
  var getCurrentPage = function (player_id) {
    const player = getObj('player', player_id)

    let lastPage = player.get('lastpage')

    if (!lastPage || lastPage === '') {
      let playerPages = Campaign().get('playerspecificpages')

      if (!playerPages || playerPages === '') playerPages = false

      lastPage = playerPages ? playerPages[player_id] : Campaign().get('playerpageid')
    }

    return lastPage
  }

  var pageName = function (page_id) {
    return getObj('page', page_id).get('name')
  }

  // PLAYERS
  // default is all controlledBy player
  var getPlayerCharacters = function (
    player_id,
    { journal, all } = {
      journal: false,
      all: false,
    }
  ) {
    const chars = findObjs({
      type: 'character',
    }).filter((o) => {
      const controlledBy = o.get('controlledby')
      const inPlayerJournals = o.get('inplayerjournals')

      if (all) {
        return inPlayerJournals.match(new RegExp(player_id, 'gi')) || controlledBy.match(new RegExp(player_id, 'gi'))
      } else {
        return journal ? inPlayerJournals.match(new RegExp(player_id, 'gi')) : controlledBy.match(new RegExp(player_id, 'gi'))
      }
    })

    return chars.map((char) => {
      char.player_id = player_id
      return char
    })
  }

  // CHARACTERS
  var getDefaultToken = async function (character) {
    return new Promise((resolve) => {
      character.get('defaulttoken', (data) => {
        const defaultToken = JSON.parse(data)

        if (defaultToken && defaultToken.name !== undefined) {
          defaultToken.player_id = character.player_id
          return resolve(defaultToken)
        }

        resolve(undefined)
      })
    })
  }

  var getCharacterToken = async function (character, page_id) {
    const defaultToken = await getDefaultToken(character)

    if (!defaultToken) return undefined

    const token = findObjs({
      type: 'graphic',
      represents: defaultToken.represents,
      pageid: page_id,
    })[0]

    if (token) token.player_id = character.player_id || defaultToken.player_id

    return token
  }

  // CAMERA
  var centerCamera = function (identifier, page_id, player_id) {
    const isText = typeof identifier === 'string'
    let token = identifier

    if (isText || token.get === undefined || token.get('type') !== 'graphic') {
      token = isText
        ? findObjs({
            type: 'graphic',
            name: identifier,
            pageid: page_id,
          })[0]
        : findObjs(
            _.extend(
              {
                type: 'graphic',
                pageid: page_id,
              },
              identifier
            )
          )[0]

      if (isText && token === undefined)
        token = findObjs({
          type: 'graphic',
          represents: identifier,
          pageid: page_id,
        })
    }

    if (token) {
      sendPing(token.get('left'), token.get('top'), token.get('pageid'), '', true, player_id ? [player_id] : undefined)
    } else {
      sendChat(
        'AprilCore:error',
        `/w gm Token ${
          typeof identifier === 'string' ? identifier : JSON.stringify(identifier)
        } is not present in page ${pageName(page_id)}.`
      )
    }

    return token
  }

  var CheckInstall = function () {
    log('[april] AprilCore v' + version + ' is ready!  Designed for use with the ' + sheetVersion + ' character sheet!')
    if (!_.has(state, 'aprilCore') || state.aprilCore.version !== schemaVersion) {
      log('  > Updating Schema to v' + schemaVersion + ' <')
      state.aprilCore = {
        version: schemaVersion,
      }
    }

    const functions = {
      escapeURI,
      actionName,
      makeid,
      isNpc,
      getSelectedCharacters,
      getSelectedTokens,
      getCurrentPage,
      pageName,
      getPlayerCharacters,
      getDefaultToken,
      getCharacterToken,
      centerCamera,
    }

    _.each(functions, (fn, name) => {
      state.aprilCore[name] = fn
    })
  }

  return {
    CheckInstall: CheckInstall,
  }
})()

on('ready', function () {
  aprilCore.CheckInstall()
})

/*
// GENERATE HTML FRINDLY STRING
!oglutils html <text>

// GET ALL ATTRIBUTES
!oglutils exec log(findObjs({type:'attribute', characterid: state.aprilCore.getSelectedCharacters(msg.selected)[0].get('id')}))
// GET REPEATRING TRAITS (PC AND NPC)
!oglutils exec log(findObjs({type:'attribute', characterid: state.aprilCore.getSelectedCharacters(msg.selected)[0].get('id')}).filter((o) => /repeating_(traits|npctrait)_[^_]+_name\b/.test(o.get('name'))))

!oglutils exec log(findObjs({type:'attribute', characterid: state.aprilCore.getSelectedCharacters(msg.selected)[0].get('id')}).filter((o) => /^repeating_spell-[^_]+_[^_]+_(spellname|spellprepared)/.test(o.get('name'))))
!oglutils exec log(findObjs({type:'attribute', characterid: state.aprilCore.getSelectedCharacters(msg.selected)[0].get('id')}).filter((o) => /^lvl(\d)_slots_(total|expended)$/.test(o.get('name'))))

// UPDATE GMNOTES BASED ON ORIGINAL GMNOTE FROM A SELECTED TOKEN
!oglutils exec _.each(findObjs({type: 'graphic', name: 'The Stream'}), token => token.set('gmnotes', selected[0].get('gmnotes')))
*/
