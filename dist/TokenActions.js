/* eslint-disable prefer-destructuring */
/* global on, log, _, state, sendChat, getObj, findObjs, createObj, getAttrByName, filterObjs */

var tokenAction = (function () {
  var version = '0.0.2',
    schemaVersion = '0.0.2',
    sheetVersion = '5th Edition OGL by Roll20 2.0'

  var CheckInstall = function () {
    log('[april] TokenActions v' + version + ' is ready!  Designed for use with the ' + sheetVersion + ' character sheet!')
    if (!_.has(state, 'TokenActions') || state.TokenActions.version !== schemaVersion) {
      log('  > Updating Schema to v' + schemaVersion + ' <')
      state.TokenActions = {
        version: schemaVersion,
      }
    }

    if (!state.TokenActions.creating) state.TokenActions.creating = false
    if (!state.TokenActions.base)
      state.TokenActions.base = {
        ids: [],
      }
    if (!state.TokenActions.base.ids) state.TokenActions.base.ids = []

    sendChat(
      'TokenActions',
      '/w GM ' +
        '<div style="width: 100% ; border-radius: 4px ; box-shadow: 1px 1px 1px #707070 ; text-align: center ; vertical-align: middle ; padding: 3px 0px ; margin: 0px auto ; border: 1px solid #000 ; color: #000 ; background-image: -webkit-linear-gradient( -45deg , #a7c7dc 0% , #85b2d3 100% )"><b>API READY</b></div>'
    )
  }

  var RegisterEventHandlers = function () {
    on('chat:message', handleInput)
    on('change:attribute:current', handleFeatureUpdate)
  }

  // HELPERS
  var resetState = function () {
    state.TokenActions.creating = false
  }

  var deleteAbilities = function (id, protocol) {
    var abilities = findObjs({ _type: 'ability', _characterid: id })

    _.each(abilities, function (r) {
      if (protocol === 'all' || r.get('name').match(/^b-/i)) r.remove()
    })
  }

  var createAllAbilities = function (id, featureList) {
    var characterName = getAttrByName(id, 'character_name')

    if (!featureList) {
      var regex = /repeating_(traits|npctrait)_[^_]+_name\b/

      var featureNames = findObjs({
        _type: 'attribute',
        _characterid: id,
      }).filter((o) => o.get('name').match(regex))

      // log('featureNames')
      // log(featureNames)

      featureList = featureNames.map((o) => {
        var current = o
          .get('current')
          .replace(/[\.\n]+$/, '')
          .replace(/^\n+/, '')
        var name = o.get('name')
        var repeatingId = name.split('_')[2]

        var featureAttrs = filterObjs(function (o) {
          return (
            o.get('type') === 'attribute' &&
            o.get('characterid') === id &&
            o.get('name').match(new RegExp('repeating_(traits|npctrait)_' + repeatingId + '_'))
          )
        })

        // log(current)
        // log('featureAttrs')
        // log(featureAttrs)

        return {
          name: current,
          source: (
            featureAttrs.find(
              (o) =>
                o.get('type') === 'attribute' &&
                o.get('characterid') === id &&
                o.get('name').match(new RegExp('repeating_(traits|npctrait)_' + repeatingId + '_source'))
            ) || { get: () => undefined }
          ).get('current'),
          source_type: (
            featureAttrs.find(
              (o) =>
                o.get('type') === 'attribute' &&
                o.get('characterid') === id &&
                o.get('name').match(new RegExp('repeating_(traits|npctrait)_' + repeatingId + '_source_type'))
            ) || { get: () => undefined }
          ).get('current'),
          description: featureAttrs
            .find(
              (o) =>
                o.get('type') === 'attribute' &&
                o.get('characterid') === id &&
                o.get('name').match(new RegExp('repeating_(traits|npctrait)_' + repeatingId + '_(description|desc)'))
            )
            .get('current'),
        }
      })
    }

    // log('featureList')
    // log(featureList)

    var features = featureList.map((feature) => {
      feature.base_name = state.aprilCore.actionName(feature.name)
      feature.inline_description = feature.description

      var pre_fixes = {
        plus: '+',
      }

      _.each(Object.keys(pre_fixes), (key) => {
        feature.inline_description = feature.inline_description.replace(new RegExp(key, 'gi'), pre_fixes[key])
      })

      var wrappers = [/(d?\d+d?\d*\s*\+\s*[a-z\+\s]+(bonus|modifier|score|die|level))/gi]

      var patterns = {
        '(yours?\\s*)?proficiency bonus': '@{selected|pb}',
        '(yours?\\s*)?(str|dex|int|con|wis|cha)[a-z]+\\s*modifier': '@{selected|$2_mod}',
        '(yours?\\s*)?([a-z]+) level': '@{selected|$2_level}', // class level
        '(yours?\\s*)?martial arts die': '1d[[4 + 2 * floor((@{selected|monk_level} + 1) / 6)]]',
      }

      _.each(wrappers, (key) => {
        var matches = feature.inline_description.match(key)

        _.each(matches, (match) => {
          var inline = match

          _.each(Object.keys(patterns), (key) => {
            inline = inline.replace(new RegExp(key, 'gi'), patterns[key])
          })

          feature.inline_description = feature.inline_description.replace(match, `[[${inline}]]`)
        })
      })

      var fixes = {
        str_mod: 'strength_mod',
        dex_mod: 'dexterity_mod',
        int_mod: 'intelligence_mod',
        con_mod: 'constitution_mod',
        wis_mod: 'wisdom_mod',
        cha_mod: 'charisma_mod',
      }

      _.each(Object.keys(fixes), (key) => {
        feature.inline_description = feature.inline_description.replace(new RegExp(key, 'gi'), fixes[key])
      })

      feature.action = `@{${characterName}|wtype}&{template:traits} @{${characterName}|charname_output} {{name=${feature.name}}}${
        feature.source !== undefined ? ` {{source=${feature.source}: ${feature.source_type}}}` : ''
      } {{description=${feature.inline_description}}}`

      return feature
    })

    _.each(features, function (feature) {
      var isDefaultTokenAction = false //['background', 'feat'].includes(feature.source.toLowerCase())
      var sortedName = (isDefaultTokenAction ? '' : 'b-') + feature.base_name

      var checkAbility = findObjs({ _type: 'ability', _characterid: id, name: sortedName })

      if (checkAbility[0]) {
        checkAbility[0].set({ action: feature.action })
      } else {
        createObj('ability', { name: sortedName, action: feature.action, characterid: id, istokenaction: isDefaultTokenAction })
      }
    })
  }

  var featureData = function (id, repeatingId) {
    var traitData = findObjs({
      type: 'attribute',
      characterid: id,
    })
      .filter((o) =>
        o.get('name').match(new RegExp(`repeating_(traits|npctrait|npcaction-l|npcaction)_${repeatingId}_([^_]+)`, 'i'))
      )
      .map((o) => {
        let key = o
          .get('name')
          .match(new RegExp(`repeating_(traits|npctrait|npcaction-l|npcaction)_${repeatingId}_([^_]+_?[^_]*)`, 'i'))

        return [key[2], o.get('current')]
      })
      .reduce((obj, cur) => {
        return Object.assign(obj, {
          [cur[0]]: cur[1],
        })
      }, {})

    traitData.repeatingId = repeatingId
    traitData.characterId = id

    return traitData
  }

  var showCreationMenu = function () {
    if (state.TokenActions && state.TokenActions.creating) {
      var id = state.TokenActions.creating.for[0]
      var mode = state.TokenActions.creating.target

      var { suffix } = state.TokenActions.creating

      var regex =
        mode === 'feature'
          ? /repeating_(traits|npctrait)_[^_]+_(name|source)\b/
          : /repeating_(attack|npcaction-l|npcaction)_[^_]+_(atkname|name)\b/
      var regexKey =
        mode === 'feature'
          ? /repeating_(traits|npctrait)_[^_]+_([^_]+_?[^_]*)\b/
          : /repeating_(attack|npcaction-l|npcaction)_[^_]+_([^_]+_?[^_]*)\b/

      var elements = {}
      findObjs({
        type: 'attribute',
        characterid: id,
      })
        .filter((o) => o.get('name').match(regex))
        .map((o) => {
          let key = o.get('name').match(regexKey)[2]
          let repeatingId = o.get('name').split('_')[2]

          if (elements[repeatingId] === undefined) elements[repeatingId] = {}

          elements[repeatingId][key] = o
        })

      // var img = "http://worldcitizenfinancial.com/wp-content/uploads/2014/07/Light-Blue-Gradient-Texture-11-1024x576.jpg";
      // var tshadow = "-1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000 , 2px 2px #222;";
      var style =
        'style="text-align:center; border: 1px solid black; margin: 1px; background-color: #6FAEC7;border-radius: 4px;  box-shadow: 1px 1px 1px #707070;'
      var off = '#A84D4D'
      var green = '#0f9d58'
      // var FX = state.auraDeadFX.substring(0, 4);
      sendChat(
        'TokenActions',
        '/w GM <br>' +
        '<div>' +
        '<u style="font-size: 0.85em">Version: ' +
        state.TokenActions.version +
        '</u><br>' +
        '<b>' +
        (mode === 'feature' ? 'Features & Traits' : 'Attacks & Spellcasting') +
        '</b>' +
        '<span style="margin-left: 8px; opacity: 0.85">' +
        state.TokenActions.creating.hash +
        '</span><br>' +
        getAttrByName(id, 'character_name') +
        '' + //--
        '<hr>' +
        Object.values(elements)
          .map(function (element) {
            var o = element.atkname || element.name
            var secondary = mode === 'feature' ? ` (${element.source ? element.source.get('current') : 'Racial'})` : ''

            var text = `${o
              .get('current')
              .replace(/[\.\n]+$/, '')
              .replace(/^\n+/, '')}${secondary}`
            var name = o.get('name')

            var isSelected = state.TokenActions.creating.stack.find(function (s) {
              return s === name
            })

            // log([isSelected, name, text])

            return (
              '<a ' +
              style +
              'background-color:' +
              (isSelected ? '' : off) +
              ';" href="!tokenactions toggle ' +
              name +
              '">' +
              text +
              '</a>'
            )
          })
          .join('<br>') +
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
        `<a ${style} background-color:${suffix ? '' : off};" href="!tokenactions suffix ${suffix ? 'off' : 'on'}">${
          !suffix ? 'No ' : ''
        }Suffix</a><br>` + //--
        '<hr>' +
        '<a ' +
        style +
        'background-color:' +
        green +
        ';" href="!tokenactions submit">Submit</a><br>' + //--
        '<a ' +
        style +
        'background-color:' +
        green +
        ';" href="!tokenactions submit one">Submit Individually</a><br>' + //--
          '</div>'
      )
    }
  }

  var handleFeatureUpdate = function (a, p) {
    const name = a.get('name')
    const id = a.get('characterid')
    if (state.TokenActions.base.ids.includes(id)) {
      if (name.match(/repeating_(traits|npctrait)_[^_]+_(description|name|source|source_type)/i)) {
        let repeatingId = name.split('_')[2]

        let feature = featureData(id, repeatingId)

        createAllAbilities(id, [feature])

        sendChat('TokenAction', `/w gm Updated repeating_trait ${feature.name} (${repeatingId}) from "${id}".`)
      }
    }
  }

  var handleInput = function (msg) {
    var char
    var command = msg.content.split(/\s+/)
    if (msg.type === 'api' && command[0] === '!tokenactions') {
      if (command[1] === 'reset') {
        resetState()
        sendChat('TokenAction', '/w ' + msg.who + ' Reseting current state.')
      } else if (command[1] === 'log') {
        log(state.TokenActions)
      } else if (command[1] === 'clear' && msg.selected) {
        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected)).map(function (c) {
          return c.id
        })

        _.each(char, function (id) {
          deleteAbilities(id, command[2])

          sendChat('TokenAction', '/w ' + msg.who + ' Deleting all abilities from ' + getAttrByName(id, 'character_name') + '.')
        })
      } else if (command[1] === 'base') {
        if (msg.selected) {
          char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected)).map(function (c) {
            return c.id
          })

          _.each(char, function (id) {
            createAllAbilities(id)
            if (!state.TokenActions.base.ids.includes(id)) state.TokenActions.base.ids.push(id)

            sendChat(
              'TokenAction',
              '/w ' + msg.who + ' Base parsing all features from ' + getAttrByName(id, 'character_name') + '.'
            )
          })
        } else {
          const characters = state.TokenActions.base.ids
          sendChat(
            'TokenAction',
            '/w ' +
              msg.who +
              ` Base parsing all features from: ${characters.map((id) => getAttrByName(id, 'character_name')).join(', ')}.`
          )
        }
      } else if (command[1] === 'create' && msg.selected) {
        char = _.uniq(state.aprilCore.getSelectedCharacters(msg.selected))

        if (!state.TokenActions.creating) {
          state.TokenActions.creating = {
            for: char.map(function (c) {
              return c.id
            }),
            target: command[2],
            stack: [],
            hash: state.aprilCore.makeid(5),
            suffix: true,
          }
        }

        showCreationMenu()
      } else if (command[1] === 'toggle' && state.TokenActions.creating) {
        var isSelected = state.TokenActions.creating.stack.find(function (s) {
          return s === command[2]
        })

        if (isSelected)
          state.TokenActions.creating.stack = state.TokenActions.creating.stack.filter(function (item) {
            return item !== command[2]
          })
        else state.TokenActions.creating.stack.push(command[2])

        sendChat(
          'TokenAction',
          '/w ' + msg.who + ' Toggling (' + (isSelected ? 'removing' : 'adding') + ') object ' + command[2] + ' at stack.'
        )

        showCreationMenu()
      } else if (command[1] === 'suffix' && state.TokenActions.creating) {
        state.TokenActions.creating.suffix = command[2] === 'on'

        sendChat('TokenAction', '/w ' + msg.who + ' Turning suffix ' + command[2].toUpperCase() + '.')

        showCreationMenu()
      } else if (command[1] === 'submit' && state.TokenActions.creating) {
        var tokenName = state.TokenActions.creating.target + '-' + state.TokenActions.creating.hash
        var label = state.TokenActions.creating.target === 'feature' ? 'Features & Traits' : 'Attacks & Spellcasting'
        var id = state.TokenActions.creating.for[0]

        var objects = state.TokenActions.creating.stack.map((name) => {
          var roll20Object = findObjs({
            type: 'attribute',
            characterid: id,
          }).filter((o) => o.get('name') === name)[0]

          var attributeName = 'b-' + state.aprilCore.actionName(roll20Object.get('current')) // TODO: Check for name variants, put here the existent one

          if (state.TokenActions.creating.target === 'attack') {
            if (!state.aprilCore.isNpc(id)) attributeName = `repeating_attack_${name.split('_')[2]}_attack`
            else {
              const isLegendary =
                findObjs({ type: 'attribute', characterid: id, name: `repeating_npcaction-l_${name.split('_')[2]}_name` })
                  .length > 0
              attributeName = `repeating_${isLegendary ? 'npcaction-l' : 'npcaction'}_${name.split('_')[2]}_npc_action`
            }
          }

          return {
            text: roll20Object
              .get('current')
              .replace(/[\.\n]+$/, '')
              .replace(/^\n+/, ''),
            name: attributeName,
          }
        })

        if (command[2] === 'one' || objects.length === 1) {
          _.each(objects, (o) => {
            createObj('ability', {
              name: `${state.aprilCore.actionName(o.text)}${state.TokenActions.creating.suffix ? '-' + tokenName : ''}`,
              action: `%{selected|${o.name}}`,
              characterid: id,
              istokenaction: true,
            })
          })
        } else {
          var description = objects
            .map(function (o) {
              return `[${o.text}](~selected|${o.name})`
            })
            .join('\n')

          createObj('ability', {
            name: tokenName,
            action: `/w gm @{wtype} &{template:npcaction} {{name=@{character_name}}}{{rname=${label}}} {{description=${description}}}`,
            characterid: id,
            istokenaction: true,
          })
        }

        sendChat('TokenAction', '/w ' + msg.who + ' Submitting new token action as ' + tokenName + '.')
      } else {
        sendChat('TokenAction', '/w ' + msg.who + ' Command <' + command[1] + '> not implemented.')
      }
    }
  }

  return {
    CheckInstall: CheckInstall,
    RegisterEventHandlers: RegisterEventHandlers,
  }
})()

on('ready', function () {
  tokenAction.CheckInstall()
  tokenAction.RegisterEventHandlers()
})
