/* eslint-disable prefer-destructuring */
/* global on, log, _, state, sendChat, getObj, findObjs, Campaign, sendPing, getAttrByName, createObj, playerIsGM */

var tokenPage = (function () {
  var version = '0.0.1',
    schemaVersion = '0.0.6',
    sheetVersion = '5th Edition OGL by Roll20 2.0'

  var CheckInstall = function () {
    log('[april] TokenPage v' + version + ' is ready!  Designed for use with the ' + sheetVersion + ' character sheet!')
    if (!_.has(state, 'TokenPage') || state.TokenPage.version !== schemaVersion) {
      log('  > Updating Schema to v' + schemaVersion + ' <')
      state.TokenPage = {
        version: schemaVersion,
      }
    }

    if (!state.TokenPage.open) state.TokenPage.open = false
    if (!state.TokenPage.page) state.TokenPage.page = false
    if (!state.TokenPage.tokens) state.TokenPage.tokens = []
    if (!state.TokenPage.tokenPlayerIndex) state.TokenPage.tokenPlayerIndex = {}
    if (!state.TokenPage.initialPosition) state.TokenPage.initialPosition = false
    if (!state.TokenPage.fixedPosition) state.TokenPage.fixedPosition = false

    sendChat(
      'TokenPage',
      '/w GM ' +
        '<div style="width: 100% ; border-radius: 4px ; box-shadow: 1px 1px 1px #707070 ; text-align: center ; vertical-align: middle ; padding: 3px 0px ; margin: 0px auto ; border: 1px solid #000 ; color: #000 ; background-image: -webkit-linear-gradient( -45deg , #a7c7dc 0% , #85b2d3 100% )"><b>API READY</b></div>'
    )
  }

  var RegisterEventHandlers = function () {
    on('chat:message', handleInput)
  }

  // HELPERS
  var resetState = function () {
    state.TokenPage.open = false
    state.TokenPage.tokens = []
    state.TokenPage.tokenPlayerIndex = {}
    state.TokenPage.page = false
    state.TokenPage.initialPosition = false
    state.TokenPage.fixedPosition = false
  }

  var getDefaultTokens = function (page, player, chars, callback) {
    const tokens = []
    let index = 0

    const addToTokens = (token) => {
      if (token) {
        let data = JSON.parse(token)
        if (data && data.name !== undefined) {
          let targetToken = findObjs({
            type: 'graphic',
            represents: data.represents,
            pageid: page,
          })[0]

          if (targetToken) tokens.push(targetToken)
        }
      }
      index++

      if (index === chars.length) {
        callback({
          [player]: tokens,
        })
      }
    }
    chars.map((c) => c.get('defaulttoken', addToTokens))
  }

  var getPlayerTokens = function (page, callback) {
    const online = findObjs({
      type: 'player',
      online: true,
    }).filter((o) => !playerIsGM(o.get('id')))

    const controlledBy = online.reduce((obj, player) => {
      return Object.assign(obj, {
        [player.get('displayname')]: findObjs({
          type: 'character',
        }).filter((o) => o.get('controlledby').match(new RegExp(player.get('id'), 'gi'))),
      })
    }, {})

    const index = {}
    let i = 0

    _.each(controlledBy, (chars, player) => {
      getDefaultTokens(page, player, chars, (playerTokenObj) => {
        Object.assign(index, playerTokenObj)
        i++

        if (i === online.length) callback(index)
      })
    })
  }

  var showMenu = function (index) {
    if (state.TokenPage && state.TokenPage.open && state.TokenPage.page) {
      const pageObj = getObj('page', state.TokenPage.page)

      const { fixedPosition } = state.TokenPage
      // var img = "http://worldcitizenfinancial.com/wp-content/uploads/2014/07/Light-Blue-Gradient-Texture-11-1024x576.jpg";
      // var tshadow = "-1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000 , 2px 2px #222;";
      var style =
        'style="text-align:center; border: 1px solid black; margin: 1px; background-color: #6FAEC7;border-radius: 4px;  box-shadow: 1px 1px 1px #707070;'
      var off = '#A84D4D'
      var green = '#0f9d58'
      // var FX = state.auraDeadFX.substring(0, 4);
      sendChat(
        'TokenPage',
        '/w GM <br>' +
        '<div>' +
        '<u style="font-size: 0.85em">Version: ' +
        state.TokenPage.version +
        '</u><br>' +
        `Move Tokens at <b>${pageObj.get('name')}</b>` +
        '<hr>' +
        Object.keys(index)
          .map((player) => {
            const player_id = findObjs({
              type: 'player',
              displayname: player,
            })[0].get('id')

            return (
              `<b style="margin-right: 8px">${player}</b>` +
              index[player]
                .map((token) => {
                  const token_id = token.get('id')
                  const isSelected = state.TokenPage.tokens.includes(token_id)
                  return `<a ${style}background-color:${
                    isSelected ? '' : off
                  };" href="!tokenpage toggle ${token_id} ${player_id}">${token.get('name')}</a>`
                })
                .join('   ')
            )
          })
          .join('<hr>') +
        // 'Bar: <a ' + style + '" href="!aura bar ?{BarNumber?|1}">' + state.auraBar + '</a><br>' + //--
        // 'Use Tint: <a ' + style + 'background-color:' + (state.auraTint !== true ? off : "") + ';" href="!aura tint">' + (state.auraTint !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'Percentage: <a ' + style + '" href="!aura perc ?{Percent?|100}">' + state.auraPerc + '</a><br>' + //--
        // 'Show on PC: <a ' + style + 'background-color:' + (state.PCAura !== true ? off : "") + ';" href="!aura pc">' + (state.PCAura !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'Show on NPC: <a ' + style + 'background-color:' + (state.NPCAura !== true ? off : "") + ';" href="!aura npc">' + (state.NPCAura !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'Show Dead: <a ' + style + 'background-color:' + (state.auraDead !== true ? off : "") + ';" href="!aura dead">' + (state.auraDead !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'DeathFX: <a ' + style + '" href="!aura deadfx ?{Sound Name?|None}">' + FX + '</a><br>' + //--
        // '<hr>' + //--
        // 'GM Sees NPC Names: <a ' + style + 'background-color:' + (state.GM_NPCNames !== true ? off : "") + ';" href="!aura gmnpc">' + (state.GM_NPCNames !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'GM Sees PC Names: <a ' + style + 'background-color:' + (state.GM_PCNames !== true ? off : "") + ';" href="!aura gmpc">' + (state.GM_PCNames !== true ? "No" : "Yes") + '</a><br>' + //--
        // '<hr>' + //--
        // 'PC Sees NPC Names: <a ' + style + 'background-color:' + (state.NPCNames !== true ? off : "") + ';" href="!aura pcnpc">' + (state.NPCNames !== true ? "No" : "Yes") + '</a><br>' + //--
        // 'PC Sees PC Names: <a ' + style + 'background-color:' + (state.PCNames !== true ? off : "") + ';" href="!aura pcpc">' + (state.PCNames !== true ? "No" : "Yes") + '</a><br>' + //--
        '<hr>' +
        `<a ${style} background-color:${fixedPosition ? '' : off};" href="!tokenpage fixed ${
          fixedPosition ? 'off' : 'on'
        }">Fixed Position</a><br>` + //--
        `<a ${style} background-color:${state.TokenPage.initialPosition ? '' : off};" href="!tokenpage open">${
          state.TokenPage.initialPosition ? 'Initial Position Selected' : 'Unknown Initial Position'
        }</a><br>` + //--
        '<hr>' +
        `<a ${style}background-color:${green};" href="!tokenpage move">Move</a><br>` + //--
          '</div>'
      )
    }
  }

  var handleInput = function (msg) {
    var char
    var command = msg.content.split(/\s+/)
    if (msg.type === 'api' && command[0] === '!tokenpage') {
      if (command[1] === 'reset') {
        resetState()
        sendChat('TokenPage', '/w ' + msg.who + ' Reseting current state.')
      } else if (command[1] === 'log') {
        log(state.TokenPage)
      } else if (command[1] === 'open') {
        if (!state.TokenPage.open) {
          const currentPage = state.aprilCore.getCurrentPage(msg.playerid)

          state.TokenPage.open = true
          state.TokenPage.page = currentPage
        }

        state.TokenPage.initialPosition = msg.selected && msg.selected[0]

        getPlayerTokens(state.TokenPage.page, showMenu)
      } else if (command[1] === 'toggle') {
        const token_id = command[2]
        const player_id = command[3]

        const isSelected = state.TokenPage.tokens.includes(token_id)

        if (isSelected) {
          state.TokenPage.tokens = state.TokenPage.tokens.filter((id) => id !== token_id)
          delete state.TokenPage.tokenPlayerIndex[token_id]
        } else {
          state.TokenPage.tokens.push(token_id)
          state.TokenPage.tokenPlayerIndex[token_id] = player_id
        }

        getPlayerTokens(state.TokenPage.page, showMenu)
      } else if (command[1] === 'move') {
        state.TokenPage.open = false

        const silent = command[command.length - 1] === 'silent'

        const tokenIds = state.TokenPage.tokens
        const tokens = tokenIds.map((id) => getObj('graphic', id))

        const page_id = state.TokenPage.page

        // Move the tokens to initial position if required
        if (state.TokenPage.fixedPosition && state.TokenPage.initialPosition) {
          const obj = getObj(state.TokenPage.initialPosition._type, state.TokenPage.initialPosition._id)

          _.each(tokens, (token) => {
            token.set('left', obj.get('left'))
            token.set('top', obj.get('top'))
          })
        }

        // Set the target page as current page for subset of players
        const player_ids = _.uniq(tokenIds.map((id) => state.TokenPage.tokenPlayerIndex[id]))
        let playerPages = {} // Campaign().get("playerspecificpages") || {}

        player_ids.map((id) => (playerPages[id] = page_id))

        Campaign().set('playerspecificpages', false)
        Campaign().set('playerspecificpages', playerPages)

        // Send ping at tokens for players
        setTimeout(() => {
          _.each(tokens, (token) => {
            const player_id = state.TokenPage.tokenPlayerIndex[token.get('id')]
            sendPing(token.get('left'), token.get('top'), page_id, '', true, [player_id])
          })

          if (!silent) sendChat('TokenPage', `/w ${msg.who} Moving tokens (${tokens.map((t) => t.get('name')).join(', ')}).`)
        }, 500)
      } else if (command[1] === 'fixed') {
        state.TokenPage.fixedPosition = command[2] === 'on'
        getPlayerTokens(state.TokenPage.page, showMenu)
      } else {
        sendChat('TokenPage', '/w ' + msg.who + ' Command <' + command[1] + '> not implemented.')
      }
    }
  }

  return {
    CheckInstall: CheckInstall,
    RegisterEventHandlers: RegisterEventHandlers,
  }
})()

on('ready', function () {
  tokenPage.CheckInstall()
  tokenPage.RegisterEventHandlers()
})
