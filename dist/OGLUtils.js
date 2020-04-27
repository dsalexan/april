/* eslint-disable prefer-destructuring */
/* global on, log, _, state, sendChat, getObj, findObjs, createObj, getAttrByName, filterObjs, playerIsGM, randomInteger */

var oglUtils = (function () {
  var version = '0.0.2',
    schemaVersion = '0.0.1',
    sheetVersion = '5th Edition OGL by Roll20 2.0'

  var CheckInstall = function () {
    log('[april] OGLUtils v' + version + ' is ready!  Designed for use with the ' + sheetVersion + ' character sheet!')

    sendChat(
      'OGLUtils',
      '/w GM ' +
        '<div style="width: 100% ; border-radius: 4px ; box-shadow: 1px 1px 1px #707070 ; text-align: center ; vertical-align: middle ; padding: 3px 0px ; margin: 0px auto ; border: 1px solid #000 ; color: #000 ; background-image: -webkit-linear-gradient( -45deg , #a7c7dc 0% , #85b2d3 100% )"><b>API READY</b></div>'
    )
  }

  var RegisterEventHandlers = function () {
    on('chat:message', handleInput)

    on('change:attribute:current', handleLevelUp)
  }

  // HELPERS
  var attrLookup = function (character, name, caseSensitive) {
    let match = name.match(/^(repeating_.*)_\$(\d+)_.*$/)
    if (match) {
      let index = match[2],
        attrMatcher = new RegExp(`^${name.replace(/_\$\d+_/, '_([-\\da-zA-Z]+)_')}$`, caseSensitive ? 'i' : ''),
        createOrderKeys = [],
        attrs = _.chain(findObjs({ type: 'attribute', characterid: character.id }))
          .map((a) => {
            return { attr: a, match: a.get('name').match(attrMatcher) }
          })
          .filter((o) => o.match)
          .each((o) => createOrderKeys.push(o.match[1]))
          .reduce((m, o) => {
            m[o.match[1]] = o.attr
            return m
          }, {})
          .value(),
        sortOrderKeys = _.chain(
          (
            (
              findObjs({
                type: 'attribute',
                characterid: character.id,
                name: `_reporder_${match[1]}`,
              })[0] || { get: _.noop }
            ).get('current') || ''
          ).split(/\s*,\s*/)
        )
          .intersection(createOrderKeys)
          .union(createOrderKeys)
          .value()
      if (index < sortOrderKeys.length && _.has(attrs, sortOrderKeys[index])) {
        return attrs[sortOrderKeys[index]]
      }
      return
    }
    return findObjs({ type: 'attribute', characterid: character.id, name: name })[0]
  }

  var checkResourceRestDefinitions = function (id) {
    var obj = {}

    // fixed

    var class_resource = getAttrByName(id, 'class_resource_name').replace(/\s+/gi, '')
    var other_resource = getAttrByName(id, 'other_resource_name').replace(/\s+/gi, '')

    var errors = []
    var def
    if (class_resource && class_resource !== '') {
      def = getAttrByName(id, 'class_resource_reset')
      if (!def || def === '') errors.push('There is no Class Resource reset definition (class_resource_reset).')
      else obj.class_resource = def
    }

    if (other_resource && other_resource !== '') {
      def = getAttrByName(id, 'other_resource_reset')
      if (!def || def === '') errors.push('There is no Other Resource reset definition (other_resource_reset).')
      else obj.other_resource = def
    }

    // repeating
    var repeating_resources_IDS = filterObjs(
      (o) =>
        o.get('type') === 'attribute' &&
        o.get('characterid') === id &&
        o.get('name').match(/repeating_resource_[^_]+_resource_left\b/gi)
    ).map((o) => o.get('name').split('_')[2])
    //repeating_resource_$0_resource_left

    if (repeating_resources_IDS.length > 0) {
      obj.repeating_resource = {
        left: {},
        right: {},
      }

      var INDEX = {}
      _.each(repeating_resources_IDS, function (cur, i) {
        INDEX[cur] = i
      })

      //repeating_resource_$0_(left|right)_reset

      var valid_ones = filterObjs(
        (o) =>
          o.get('type') === 'attribute' &&
          o.get('characterid') === id &&
          o.get('name').match(/repeating_resource_[^_]+_resource_(left|right)_name\b/gi)
      )

      _.each(valid_ones, function (element, index) {
        var name = element.get('current').replace(/\s+/gi, '')
        var repeatingId = element.get('name').split('_')[2]
        var side = element.get('name').split('_')[4]

        var n = INDEX[repeatingId]
        if (name && name !== '') {
          def = getAttrByName(id, `resource_${n}_${side}_reset`)
          if (!def || def === '')
            errors.push(`There is no Repeating Resource (${n}_${side}) reset definition (resource_${n}_${side}_reset).`)
          else obj.repeating_resource[side][repeatingId] = def
        }
      })
    }

    return {
      definitions: obj,
      errors,
    }
  }

  // CORE
  var directReferencesToMulticlass = function (id) {
    var class_name = getAttrByName(id, 'class').toLowerCase()
    var active_multiclass_slots = [1, 2, 3].filter((n) => getAttrByName(id, `multiclass${n}_flag`) == '1')

    var levels = [
      {
        name: class_name,
        level: parseInt(getAttrByName(id, 'base_level')),
      },
      ...[1, 2, 3].map((n) => {
        var flag = getAttrByName(id, `multiclass${n}_flag`) == '1' ? 1 : 0
        var level = parseInt(getAttrByName(id, `multiclass${n}_lvl`))
        level = (isNaN(level) ? 0 : level) * flag

        return {
          name: getAttrByName(id, `multiclass${n}`).toLowerCase(),
          level,
        }
      }),
    ]

    _.each(levels, function (o) {
      var attribute_name = `${o.name}_level`
      var checkAttribute = findObjs({ _type: 'attribute', _characterid: id, name: attribute_name })

      if (checkAttribute[0]) {
        checkAttribute[0].set({ current: o.level })
      } else {
        createObj('attribute', {
          name: attribute_name,
          current: o.level,
          characterid: id,
        })
      }
    })
  }

  var resetResources = function (id, def, protocol) {
    var setAsMax = function (name) {
      var obj = findObjs({
        _type: 'attribute',
        _characterid: id,
        name,
      })[0]
      obj.set({ current: obj.get('max') })
    }

    _.each(['class_resource', 'other_resource'], (key) => {
      if (def[key] === protocol) {
        setAsMax(key)
      }
    })

    if (def.repeating_resource) {
      _.each(['left', 'right'], (side) => {
        _.each(def.repeating_resource[side], (reset, repeatingId) => {
          if (reset === protocol) {
            setAsMax(`repeating_resource_${repeatingId}_resource_${side}`)
          }
        })
      })
    }
  }

  var shortRest = function (id) {
    var check = checkResourceRestDefinitions(id)
    // {"definitions":{"class_resource":"long","other_resource":"short","repeating_resource":{"left":{},"right":{}}},"errors":[]}

    if (check.errors.length > 0) return check.errors.join('\n')

    resetResources(id, check.definitions, 'short')

    return
  }

  var longRest = function (id) {
    var check = checkResourceRestDefinitions(id)
    // {"definitions":{"class_resource":"long","other_resource":"short","repeating_resource":{"left":{},"right":{}}},"errors":[]}

    if (check.errors.length > 0) return check.errors.join('\n')

    resetResources(id, check.definitions, 'long')

    return
  }

  var preparedSpells = function (id) {
    const isNPC = state.aprilCore.isNpc(id)
    const spellLevelNames = {
      cantrip: 'Cantrips',
      1: '1st Level',
      2: '2nd Level',
      3: '3rd Level',
      4: '4th Level',
      5: '5th Level',
      6: '6th Level',
      7: '7th Level',
      8: '8th Level',
      9: '9th Level',
    }

    const makeButton = (level, repeatingId, name) => `[${name}](~selected|repeating_spell-${level}_${repeatingId}_spell)`
    const makeLevel = (slots, level, spellList) => {
      // qtd slots, level, spells at level
      var header = spellLevelNames[level]
      var qtd =
        !isNPC && slots
          ? ` <div style="font-weight: normal; font-style: italic;">(${slots.remaining}<span style="opacity: 0.75"> of ${slots.total}</span>)</div>`
          : ''
      return `<tr><td style="padding-left: 10px;">${header}${qtd}</td><td>${spellList
        .filter((s) => s.prepared || level === 'cantrip' || isNPC)
        .map((s) => makeButton(level, s.repeatingId, s.name))
        .join('<br>')}</td></tr>`
    }

    const slots = {}
    const spells = {}

    // get spell slots
    findObjs({
      type: 'attribute',
      characterid: id,
    })
      .filter((o) => /^lvl(\d)_slots_(total|expended)$/.test(o.get('name')))
      .map((o) => {
        const match = o.get('name').match(/^lvl(\d)_slots_(total|expended)$/)
        let level = match[1]
        let cat = match[2]

        if (slots[level] === undefined)
          slots[level] = {
            total: 0,
            remaining: 0, // it is coded as expended, but written as remaining
          }

        let value = parseInt(o.get('current'))

        slots[level][cat === 'total' ? 'total' : 'remaining'] = value
      })

    findObjs({
      type: 'attribute',
      characterid: id,
    })
      .filter((o) => /^repeating_spell-[^_]+_[^_]+_(spellname|spellprepared)/.test(o.get('name')))
      .map((o) => {
        var name = o.get('name')
        var slot = name.match(/^repeating_spell-([^_]+)_[^_]+_/)[1]
        var repeatingId = name.split('_')[2]

        if (spells[slot] === undefined) spells[slot] = {}
        if (spells[slot][repeatingId] === undefined)
          spells[slot][repeatingId] = {
            repeatingId,
          }

        if (/^repeating_spell-[^_]+_[^_]+_spellname/.test(name)) {
          // is NAME
          spells[slot][repeatingId].name = o.get('current')
        } else {
          // is PREPARED
          spells[slot][repeatingId].prepared = o.get('current') == '1'
        }
      })

    let parts = _.sortBy(Object.keys(spells), (i) => (i === 'cantrip' ? 0 : i)).map((level) => {
      return makeLevel(slots[level], level, Object.values(spells[level]))
    })

    if (parts.length > 0)
      return `<div class="sheet-rolltemplate-default" style="margin: 0 -5px"><table style="border: none"><tbody>${parts.join(
        ''
      )}</tbody></table></div>`
    else return '<span style="font-style: italic;">No Spells</span>'
  }

  var handleInput = function (msg) {
    var char
    var command = msg.content.split(/\s+/)
    if (msg.type === 'api' && command[0] === '!oglutils') {
      if (command[1] === 'multiclass' && msg.selected) {
        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected))

        _.each(char, function (character) {
          directReferencesToMulticlass(character.id)
        })

        sendChat(
          'OGLUtils',
          '/w ' +
            msg.who +
            ` Multiclass protocol executed for: ${char.map((c) => `<b>${getAttrByName(c.id, 'character_name')}</b>`).join(', ')}`
        )
      } else if ((command[1] === 'shortrest' || command[1] === 'longrest') && msg.selected) {
        var protocolName = command[1] === 'shortrest' ? 'Short' : 'Long'
        var protocol = command[1] === 'shortrest' ? 'short' : 'long'

        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected))

        _.each(char, function (character) {
          var returningMessage = protocol === 'short' ? shortRest(character.id) : longRest(character.id)
          if (returningMessage)
            sendChat('OGLUtils', '/w ' + msg.who + ` (${getAttrByName(character.id, 'character_name')}) ` + returningMessage)
        })

        if (command[2] !== 'silent')
          sendChat(
            'OGLUtils',
            '/w ' +
              msg.who +
              ` ${protocolName} Rest protocol executed for: ${char
                .map((c) => `<b>${getAttrByName(c.id, 'character_name')}</b>`)
                .join(', ')}`
          )
      } else if (command[1] === 'spells' && msg.selected && command[2] === 'prepared') {
        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected))

        _.each(char, (c) => {
          var list = preparedSpells(c.id)

          //gm @{wtype} &{template:npcaction} {{name=@{character_name}}}{{rname=${label}}} {{description=${description}}}
          sendChat(
            'OGLUtils',
            '/w ' +
              msg.who +
              ` &{template:npcaction} {{name=${getAttrByName(
                c.id,
                'character_name'
              )}}} {{rname=Prepared Spells}} {{description=${list}}}`
          )
        })
      } else if (command[1] === 'eval') {
        let name = command[2]
        let text = command
          .filter((_, i) => i > 2)
          .join(' ')
          .replace(/\s*\\n\s*/gi, '\n')
          .replace(/§/gi, '!')

        let obj =
          findObjs({
            type: 'macro',
            name,
            playerid: msg.playerid,
          })[0] ||
          createObj('macro', {
            name,
            playerid: msg.playerid,
          })

        obj.set({
          action: text,
        })

        sendChat('OGLUtils', `/w gm \n${text}`)
        sendChat('OGLUtils', `/w ${msg.who} Evaluating content to macro "${name}"`)
      } else if (command[1] === 'camera') {
        //!oglutils camera <token.name|preffix_text> ?journal|preffix ?represents ?silent
        const currentPage = state.aprilCore.getCurrentPage(msg.playerid)
        const selectedGraphics = msg.selected && msg.selected.filter((o) => o._type === 'graphic')

        const silent = command[command.length - 1] === 'silent'
        const represents = command[command.length - 1 - silent] === 'represents'
        const by_id = command[command.length - 1 - silent] === 'id'

        let selected = msg.selected && selectedGraphics.length > 0
        let character = command[command.length - 1 - silent - (represents || by_id)] === 'character'
        let preffix = command[command.length - 1 - silent - (represents || by_id)] === 'preffix'
        let journal = command[command.length - 1 - silent - (represents || by_id)] === 'journal'
        let players = command[command.length - 1 - silent - (represents || by_id)] === 'players'

        let text =
          command.length > 1
            ? command
                .filter(
                  (_, i) => i > 1 && i < command.length - silent - (represents || by_id) - (character || preffix || journal)
                )
                .join(' ')
            : false
        text = text !== '' ? text : false

        if (text === 'gm' && preffix && !playerIsGM(msg.playerid)) return

        const _default = !journal && !preffix && !character && !players
        if (_default) {
          if (text) {
            character = true
          } else if (playerIsGM(msg.playerid)) {
            // create a different mode to show all characters from players?
            players = true
          } else {
            journal = true
          }
        }

        // log({ _default, journal, preffix, character, text })

        let locator_type = 'name'
        if (represents) locator_type = 'represents'
        if (by_id) locator_type = 'id'

        if (selected || character) {
          const targetToken = state.aprilCore.centerCamera(
            text
              ? {
                  [locator_type]: text,
                }
              : selectedGraphics.length > 0
              ? {
                  id: selectedGraphics[0]._id,
                }
              : false,
            currentPage,
            msg.playerid
          )

          if (!silent && targetToken)
            sendChat('OGLUtils', `/w ${msg.who} Moving camera${!targetToken ? '' : ` to token "${targetToken.get('name')}"`}.`)
        } else {
          let tokensPromise = []

          if (journal) {
            const chars = state.aprilCore.getPlayerCharacters(msg.playerid, { journal: true })

            tokensPromise.push({
              rname: 'Characters',
              promise: Promise.all(chars.map((char) => state.aprilCore.getCharacterToken(char, currentPage))),
            })
          } else if (preffix) {
            const preffixedTokens = findObjs({
              type: 'graphic',
              pageid: currentPage,
            }).filter((o) => o.get('name').match(new RegExp(`^\\[${text}\\]`, 'i')))

            tokensPromise.push({
              rname: text,
              promise: Promise.resolve(preffixedTokens),
            })
          } else if (players) {
            let onlinePlayers = findObjs({
              type: 'player',
              online: true,
            }).filter((player) => !playerIsGM(player.get('id')))

            _.each(onlinePlayers, (player) => {
              tokensPromise.push({
                rname: player.get('displayname'),
                promise: (async (player_id) => {
                  const chars = state.aprilCore.getPlayerCharacters(player_id, { journal: true })
                  return await Promise.all(chars.map((char) => state.aprilCore.getCharacterToken(char, currentPage)))
                })(player.get('id')),
                forceTemplate: true,
              })
            })
          }

          _.each(tokensPromise, async ({ rname, promise, forceTemplate } = { rname: 'Characters', forceTemplate: false }) => {
            const rawTokens = await promise
            const tokens = rawTokens.filter((t) => t !== undefined)

            const showTemplate = tokens.length === 0 ? false : tokens.length > 1 || forceTemplate

            if (showTemplate) {
              let buttons = tokens.map((token) => {
                let tokenName = token.get('name')
                if (preffix) {
                  tokenName = tokenName.replace(new RegExp(`^\\[${text}\\]\\s*`, 'i'), '')
                  return `[${tokenName}](!oglutils camera ${token.get('id')} id silent)`
                } else return `[${tokenName}](!oglutils camera ${token.get('represents')} represents silent)`
              })

              buttons = _.sortBy(buttons, (l) => l).join('\n')

              sendChat(
                'OGLUtils',
                `/w ${msg.who} &{template:npcaction} {{name=Camera}}{{rname=${rname}}} {{description=${buttons}}}`
              )
            } else if (tokens.length === 0) {
              sendChat('OGLUtils', `/w ${msg.who} You must control at least one character with a default token set.`)
            } else {
              state.aprilCore.centerCamera(tokens[0], currentPage, msg.playerid)

              if (!silent) sendChat('OGLUtils', `/w ${msg.who} Moving camera to token "${tokens[0].get('name')}".`)
            }
          })
        }
      } else if (command[1] === 'hp') {
        var qualifier = command.filter((_, i) => i > 1).join(' ')

        var tokens = []
        if (qualifier.length > 0) {
          if ((qualifier.match(/"/g) || []).length > 1) {
            qualifier = qualifier.match(/"(.*?)"/)[1]
          } else if ((qualifier.match(/'/g) || []).length > 1) {
            qualifier = qualifier.match(/'(.*?)'/)[1]
          }
          var character = findObjs({ type: 'character', name: qualifier }, { caseInsensitive: true })[0] || false
          if (!character) {
            log("NO CHARACTER BY THAT NAME '" + qualifier + "' FOUND")
            return
          }
          var player = getObj('player', msg.playerid)
          if (!player) {
            log('NO PLAYER BY THAT ID:' + qualifier + ' FOUND')
          }
          tokens = findObjs({ type: 'graphic', subtype: 'token', represents: character.id, pageid: player.get('lastpage') })
        } else {
          tokens = msg['selected']
        }

        _.each(tokens, function (token) {
          var t_obj = getObj('graphic', token.id)
          if (!t_obj) {
            t_obj = getObj('graphic', token['_id'])
          }

          var rep_id = t_obj.get('represents')
          if (t_obj && rep_id) {
            var maxhp = getAttrByName(rep_id, 'hp', 'max')
            var formula = getAttrByName(rep_id, 'npc_hpformula')

            var bar1 = t_obj.get('bar1_value')
            var bar2 = t_obj.get('bar2_value')
            var bar3 = t_obj.get('bar3_value')

            if (formula) {
              sendChat('OGLUtils', `[[${formula}]]`, function (ops) {
                const total = ops[0].inlinerolls[0].results.total

                t_obj.set({ bar1_value: total })
                t_obj.set({ bar1_max: total })
              })

              // if (f_array.length > 1) {
              //   var n_dice = parseInt(f_array[0], 10)
              //   var d_type = parseInt(f_array[1], 10)
              //   var mod = parseInt(f_array[2], 10)
              //   var hp = mod ? mod : 0
              //   for (var i = 0; i < n_dice; i++) {
              //     hp = hp + randomInteger(d_type)
              //   }
              //   if (bar1 === maxhp) {
              //     t_obj.set({ bar1_value: hp })
              //     t_obj.set({ bar1_max: hp })
              //   } else if (bar2 === maxhp) {
              //     t_obj.set({ bar2_value: hp })
              //     t_obj.set({ bar2_max: hp })
              //   } else if (bar3 === maxhp) {
              //     t_obj.set({ bar3_value: hp })
              //     t_obj.set({ bar3_max: hp })
              //   }
              // }
            }
          }
        })
      } else if (command[1] === 'set' && msg.selected) {
        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected))
        let property = command[2] === 'silent' ? command[3] : command[2]
        const key = property.split('|')[0]
        const val = property.split('|')[1]
        const max = property.split('|')[2]
        const silent = command[2] === 'silent'

        _.each(char, (c) => {
          // repeating_damagemod_$@{selected|thunderstruck_damage}_global_damage_active_flag
          // repeating_damagemod_$0_global_damage_active_flag

          let obj = attrLookup(c, 'repeating_damagemod_$0_global_damage_active_flag', false)
          obj.set({
            current: val,
            max: max || obj.get('max'),
          })

          if (!silent)
            sendChat('OGLUtils', '/w ' + msg.who + ` Setting value for ${key} as ${val}${max !== undefined ? `|${max}` : ''}`)
        })
      } else if (command[1] === 'reference' && msg.selected) {
        const token = msg.selected && msg.selected.length > 0 && getObj(msg.selected[0]._type, msg.selected[0]._id)

        if (token) {
          let gmnotes = state.aprilCore.escapeURI(token.get('gmnotes'))

          let code = gmnotes.match(/\[(ref:[A-Z0-9]+)\]/)

          if (code) {
            code = code[1].split(':')[1]
          } else {
            let simpleName = token.get('name').replace(/^\[.*\]\s*/g, '')
            simpleName = simpleName
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, ' ')
              .split(' ')
            code = simpleName
              .map((string) => string[0])
              .filter((s) => s !== '' && s !== ' ')
              .join('')
          }

          const references = findObjs({
            _type: 'handout',
          }).filter((o) => o.get('name').match(new RegExp(`{${code}}$`)))

          let buttons =
            references.length === 0
              ? '<i>No references</i>'
              : references.map((handout) => {
                  let name = handout.get('name')
                  name = name.replace(new RegExp(`\\s*{${code}}$`), '')
                  return `<b>[${name}](http://journal.roll20.net/handout/${handout.get('id')})</b>`
                })

          sendChat(
            'OGLUtils',
            `/w ${msg.who} &{template:npcaction} {{name=${token.get(
              'name'
            )}<br/>${code}}}{{rname=References}} {{description=${buttons}}}`
          )
        }
      } else if (command[1] === 'print' && msg.selected) {
        if (command[2] === 'gmnotes' && playerIsGM(msg.playerid)) {
          let objs

          let tokens = command[3] === 'tokens'
          let characters = command[3] === 'characters'

          const _default = !tokens && !characters
          if (_default) {
            tokens = true
          }

          objs = tokens
            ? state.aprilCore.getSelectedTokens(msg.selected)
            : characters
            ? state.aprilCore.getSelectedCharacters(msg.selected)
            : []

          _.each(objs, (obj) => {
            let text = state.aprilCore.escapeURI(obj.get('gmnotes'))
            sendChat(
              'OGLUtils',
              `/w ${msg.who} &{template:npcaction} {{name=${obj.get('name')}}}{{rname=${command[2]}}} {{description=${text}}}`
            )
          })
        }
      } else if (command[1] === 'exec') {
        const selected = state.aprilCore.getSelectedTokens(msg.selected)
        const text = command.filter((_, i) => i > 1).join(' ')
        // eslint-disable-next-line no-eval
        eval(text)
      } else if (command[1] === 'html') {
        const text = command.filter((_, i) => i > 1).join(' ')

        const htmlEntities = {
          '{': '&#123;',
          '}': '&#125;',
          '(': '&#40;',
          ')': '&#41;',
          '[': '&#91;',
          ']': '&#93;',
        }

        let codedText = text
        _.each(htmlEntities, (html, original) => {
          codedText = codedText.replace(new RegExp(`[\\${original}]`, 'gi'), html)
        })
        log(codedText)
      } else {
        sendChat('OGLUtils', '/w ' + msg.who + ' Command <' + command[1] + '> not implemented.')
      }
    }
  }

  var handleLevelUp = function (a, p) {
    if (a.get('name') === 'level') {
      directReferencesToMulticlass(a.get('characterid'))

      // sendChat("OGLUtils", `/w gm (on Level Up) Multiclass protocol executed for: <b>${getAttrByName(a.get('characterid'), 'character_name')}</b>`);
    }
  }

  return {
    CheckInstall: CheckInstall,
    RegisterEventHandlers: RegisterEventHandlers,
  }
})()

on('ready', function () {
  oglUtils.CheckInstall()
  oglUtils.RegisterEventHandlers()
})
