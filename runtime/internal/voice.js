var list = {}
var time = {}
var status = {}
var requestLink = {}
var splitLink = {}
var temp
var DL = require('ytdl-core')
var YT = require('youtube-dl')
var Logger = require('./logger.js').Logger
var Config = require('../../config.json')

exports.join = function (msg, suffix, bot) {
  if (bot.VoiceConnections.length > 10) {
    msg.channel.sendMessage('Sorry, all streaming slots are taken, try again later. :cry:')
  } else {
    var voiceCheck = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (!voiceCheck && !suffix) {
      var VC = msg.member.getVoiceChannel()
      if (VC) {
        VC.join().then((vc) => {
          msg.channel.sendMessage('I\'ve joined voice channel **' + vc.voiceConnection.channel.name + '** which you\'re currently connected to. \nYou have until the end of the wait music to request something.\n\n__**Voice Commands**__\n**' + Config.settings.prefix + 'request** - *Request a song via a youtube or soundcloud link, or any kind of compatible music file.*\n**' + Config.settings.prefix + 'music pause** - *Pauses the current song.*\n**' + Config.settings.prefix + 'music play** - *Resumes the current song.*\n**' + Config.settings.prefix + 'volume** - *Change the volume of the current song.*\n\n**' + Config.settings.prefix + 'playlist** - *List upcoming requested songs.*\n**' + Config.settings.prefix + 'shuffle** - *Shuffle the music playlist.*\n\n**' + Config.settings.prefix + 'voteskip** - *Vote to skip the current song.*\n**' + Config.settings.prefix + 'skip** - *Force skip the current song.*\n\n**' + Config.settings.prefix + 'leave-voice** - *Leaves the voice channel.*')
          status[msg.guild.id] = true
          time[msg.guild.id] = setTimeout(function () {
            leave(bot, msg)
            status[msg.guild.id] = false
          }, 199000)
          waiting(vc)
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply("I could not join the channel you're in because I don't have `Connect` permissions :cry:")
          }
        })
      } else if (!VC) {
        msg.guild.voiceChannels[0].join().then((vc) => {
          msg.channel.sendMessage('I joined channel **' + vc.voiceConnection.channel.name + '** because you did not specify a channel for me to join. \nYou have until the end of the wait music to request something.')
          status[msg.guild.id] = true
          time[msg.guild.id] = setTimeout(function () {
            leave(bot, msg)
            status[msg.guild.id] = false
          }, 199000)
          waiting(vc)
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply("I could not the first voice channel in my list because I don't have `Connect` permissions :cry:")
          }
        })
      }
    } else if (!voiceCheck) {
      msg.channel.guild.voiceChannels
        .forEach((channel) => {
          if (channel.name.toLowerCase().indexOf(suffix.toLowerCase()) >= 0) {
            channel.join().then((vc) => {
              msg.channel.sendMessage('I joined **' + vc.voiceConnection.channel.name + '** \nYou have until the end of the wait music to request something.')
              status[msg.guild.id] = true
              time[msg.guild.id] = setTimeout(function () {
                leave(bot, msg)
                status[msg.guild.id] = false
              }, 199000)
              waiting(vc)
            }).catch((err) => {
              if (err.message === 'Missing permission') {
                msg.reply('Could not join channel as I do not have `Connect` permissions.')
              }
            })
          }
        })
    } else {
      msg.reply('I am already streaming on this server in channel **' + voiceCheck.voiceConnection.channel.name + '**').then((m) => {
        setTimeout(() => {
          m.delete().catch((e) => Logger.error(e))
        }, 3000)
      })
    }
  }
}

function leave (bot, msg) {
  if (status[msg.guild.id] === true) {
    msg.channel.sendMessage('Nothing has been added to the playlist during the wait time, leaving voice!')
    var voice = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (voice) {
      voice.voiceConnection.getEncoder().kill()
      voice.voiceConnection.disconnect()
      delete list[msg.guild.id]
    }
  }
}

exports.leave = function (msg, suffix, bot) {
  clearTimeout(time[msg.guild.id])
  var voice = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
  if (voice) {
    voice.voiceConnection.getEncoder().kill()
    voice.voiceConnection.disconnect()
    delete list[msg.guild.id]
  }
}

function waiting (vc) {
  var waitMusic = vc.voiceConnection.createExternalEncoder({
    type: 'ffmpeg',
    source: 'Fanta.mp3', // Caps sensitive why
    format: 'pcm'
  })
  waitMusic.play()
}

function next (msg, suffix, bot) {
  clearTimeout(time[msg.guild.id])
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (list[msg.guild.id].link.length === 0) {
          delete list[msg.guild.id]
          msg.channel.sendMessage('Playlist has ended, leaving voice.')
          connection.voiceConnection.disconnect()
          return
        }
        if (list[msg.guild.id].link[0] === 'INVALID') {
          list[msg.guild.id].link.shift()
          list[msg.guild.id].info.shift()
          list[msg.guild.id].requester.shift()
          list[msg.guild.id].skips.count = 0
          list[msg.guild.id].skips.users = []
        }
        var encoder = connection.voiceConnection.createExternalEncoder({
          type: 'ffmpeg',
          format: 'pcm',
          source: list[msg.guild.id].link[0]
        })
        encoder.play()
        var vol = (list[msg.guild.id].volume !== undefined) ? list[msg.guild.id].volume : 100
        connection.voiceConnection.getEncoder().setVolume(vol)
        encoder.once('end', () => {
          msg.channel.sendMessage('**' + list[msg.guild.id].info[0] + '** has ended!').then((m) => {
            setTimeout(() => {
              m.delete().catch((e) => Logger.error(e))
            }, 3000)
          })
          list[msg.guild.id].link.shift()
          list[msg.guild.id].info.shift()
          list[msg.guild.id].requester.shift()
          list[msg.guild.id].skips.count = 0
          list[msg.guild.id].skips.users = []
          if (list[msg.guild.id].link.length > 0) {
            msg.channel.sendMessage('Next up is **' + list[msg.guild.id].info[0] + '** requested by _' + list[msg.guild.id].requester[0] + '_').then((m) => {
              setTimeout(() => {
                m.delete().catch((e) => Logger.error(e))
              }, 6000)
            })
            next(msg, suffix, bot)
          } else {
            msg.channel.sendMessage('Playlist has ended, leaving voice.').then((m) => {
              setTimeout(() => {
                m.delete().catch((e) => Logger.error(e))
              }, 3000)
            })
            connection.voiceConnection.disconnect()
          }
        })
      }
    })
}

exports.shuffle = function (msg) {
  var currentIndex = list[msg.guild.id].link.length,
    temporaryValue, randomIndex
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    if (currentIndex !== 0 && randomIndex !== 0) {
      temporaryValue = list[msg.guild.id].link[currentIndex]
      list[msg.guild.id].link[currentIndex] = list[msg.guild.id].link[randomIndex]
      list[msg.guild.id].link[randomIndex] = temporaryValue
      temporaryValue = list[msg.guild.id].info[currentIndex]
      list[msg.guild.id].info[currentIndex] = list[msg.guild.id].info[randomIndex]
      list[msg.guild.id].info[randomIndex] = temporaryValue
      temporaryValue = list[msg.guild.id].requester[currentIndex]
      list[msg.guild.id].requester[currentIndex] = list[msg.guild.id].requester[randomIndex]
      list[msg.guild.id].requester[randomIndex] = temporaryValue
    }
  }
}

exports.voteSkip = function (msg, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.reply('No connection.')
  } else {
    var count = Math.round((connect[0].voiceConnection.channel.members.length - 2) / 2)
    if (list[msg.guild.id].skips.users.indexOf(msg.author.id) > -1) {
      msg.reply('You already voted to skip this song!')
    } else {
      list[msg.guild.id].skips.users.push(msg.author.id)
      list[msg.guild.id].skips.count++
      if (list[msg.guild.id].skips.count >= count) {
        msg.channel.sendMessage('Voteskip passed, next song coming up!')
        exports.skip(msg, null, bot)
      } else {
        msg.reply(`Voteskip registered, ${count - list[msg.guild.id].skips.count} more votes needed for the vote to pass.`)
      }
    }
  }
}

exports.volume = function (msg, suffix, bot) {
  if (!isNaN(suffix) && suffix <= 100 && suffix > 0) {
    bot.VoiceConnections
      .map((connection) => {
        if (connection.voiceConnection.guild.id === msg.guild.id) {
          list[msg.guild.id].volume = parseInt(suffix)
          connection.voiceConnection.getEncoder().setVolume(suffix)
        }
      })
  } else {
    msg.channel.sendMessage('**WHAT**')
  }
}

exports.skip = function (msg, suffix, bot) {
  list[msg.guild.id].link.shift()
  list[msg.guild.id].info.shift()
  list[msg.guild.id].requester.shift()
  list[msg.guild.id].skips.count = 0
  list[msg.guild.id].skips.users = []
  next(msg, suffix, bot)
}

exports.music = function (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (suffix.toLowerCase() === 'pause') {
          connection.voiceConnection.getEncoderStream().cork()
        } else if (suffix.toLowerCase() === 'play') {
          connection.voiceConnection.getEncoderStream().uncork()
        } else {
          msg.channel.sendMessage('Use either pause or play after the command.')
        }
      }
    })
}

exports.fetchList = function (msg) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(list[msg.guild.id])
    } catch (e) {
      reject(e)
    }
  })
}

exports.request = function (msg, suffix, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.channel.sendMessage("I'm not connected to any voice channel in this server, try initializing me with the command `voice` first!")
    return
  }
  var link = require('url').parse(suffix)
  var query = require('querystring').parse(link.query)
  msg.channel.sendTyping()
  if (suffix.includes('list=') !== suffix.includes('playlist?')) {
    requestLink[msg.guild.id] = suffix
    if (suffix.includes('youtu.be')) { // If the link is shortened with youtu.be
      splitLink[msg.guild.id] = requestLink[msg.guild.id].split('?list=') // Check for this instead of &list
      msg.channel.sendMessage(`Try ++request again with either a link to the video or the playlist.\n**Video:** <${splitLink[msg.guild.id][0]}>\n**Playlist:** <https://www.youtube.com/playlist?list=${splitLink[msg.guild.id][1]}>`)
    } else {
      splitLink[msg.guild.id] = requestLink[msg.guild.id].split('&list=')
      msg.channel.sendMessage(`Try ++request again with either a link to the video or the playlist.\n**Video:** <${splitLink[msg.guild.id][0]}>\n**Playlist:** <https://www.youtube.com/playlist?list=${splitLink[msg.guild.id][1]}>`)
    }
  } else if (query.list && query.list.length > 8 && link.host.indexOf('youtu') > -1) {
    msg.channel.sendMessage('Playlist fetching might take a while...')
    var api = require('youtube-api')
    api.authenticate({
      type: 'key',
      key: Config.api_keys.google
    })
    api.playlistItems.list({
      part: 'snippet',
      pageToken: [],
      maxResults: 50,
      playlistId: query.list
    }, function (err, data) {
      if (err) {
        msg.channel.sendMessage('Something went wrong while requesting information about this playlist.').then((m) => {
          setTimeout(() => {
            m.delete().catch((e) => Logger.error(e))
          }, 3000)
        })
        Logger.error('Playlist failiure, ' + err)
        return
      } else if (data) {
        temp = data.items
        safeLoop(msg, suffix, bot)
      }
    })
  } else {
    fetch(suffix, msg).then((r) => {
      msg.channel.sendMessage(`Added **${r.title}** to the playlist.`).then((m) => {
        setTimeout(() => {
          m.delete().catch((e) => Logger.error(e))
        }, 3000)
      })
      if (r.autoplay === true) {
        next(msg, suffix, bot)
      }
    }).catch((e) => {
      Logger.error(e)
      msg.channel.sendMessage("I couldn't add that to the playlist.").then((m) => {
        setTimeout(() => {
          m.delete().catch((e) => Logger.error(e))
        }, 3000)
      })
    })
  }
}

exports.leaveRequired = function (bot, guild) {
  var connect = bot.VoiceConnections
    .find(function (connection) {
      connection.voiceConnection.guild.id === guild
    })
  if (connect) {
    if (connect.voiceConnection.channel.members.length <= 1) {
      delete list[guild.id]
      connect.voiceConnection.disconnect()
    }
  }
}

function fetch (v, msg, stats) {
  return new Promise(function (resolve, reject) {
    var x = 0
    var y = 1
    if (stats) {
      x = stats
    }
    var options
    if (v.indexOf('youtu') > -1) {
      options = ['--skip-download', '--add-header', 'Authorization:' + Config.api_keys.google]
    } else {
      options = ['--skip-download']
    }
    YT.getInfo(v, options, function (err, i) {
      if (!err && i) {
        y++
        if (list[msg.guild.id] === undefined || list[msg.guild.id].link.length < 1) {
          list[msg.guild.id] = {
            link: [i.url],
            info: [i.title],
            volume: 100,
            requester: [msg.author.username],
            skips: {
              count: 0,
              users: []
            }
          }
          if (y > x) {
            return resolve({
              title: i.title,
              autoplay: true,
              done: true
            })
          } else {
            return resolve({
              title: i.title,
              autoplay: true
            })
          }
        } else {
          list[msg.guild.id].link.push(i.url)
          list[msg.guild.id].info.push(i.title)
          list[msg.guild.id].requester.push(msg.author.username)
          if (y > x) {
            return resolve({
              title: i.title,
              autoplay: false,
              done: true
            })
          } else {
            return resolve({
              title: i.title,
              autoplay: false
            })
          }
        }
      } else if (err) {
        y++
        if (y > x) {
          return reject({
            error: err,
            done: true
          })
        } else {
          return reject({
            error: err
          })
        }
      }
    })
  })
}

function safeLoop (msg, suffix, bot) {
  if (temp.length === 0) {
    msg.channel.sendMessage('Done fetching that playlist')
  } else {
    DLFetch(temp[0], msg, suffix, bot).then((f) => {
      if (f) {
        msg.channel.sendMessage(`Autoplaying ${list[msg.guild.id].info[0]}`)
        next(msg, suffix, bot)
      }
      temp.shift()
      safeLoop(msg, suffix, bot)
    }, () => {
      temp.shift()
      safeLoop(msg, suffix, bot)
    })
  }
}

function DLFetch (video, msg) {
  return new Promise(function (resolve, reject) {
    var first = false
    DL.getInfo('https://youtube.com/watch?v=' + video.snippet.resourceId.videoId, {
      quality: 140
    }, (err, i) => {
      if (!err && i) {
        if (list[msg.guild.id] === undefined || list[msg.guild.id].link.length < 1) {
          list[msg.guild.id] = {
            link: [],
            info: [],
            volume: 100,
            requester: [],
            skips: {
              count: 0,
              users: []
            }
          }
          first = true
        }
        list[msg.guild.id].link.push(i.formats[0].url)
        list[msg.guild.id].info.push(i.title)
        list[msg.guild.id].requester.push(msg.author.username)
        return resolve(first)
      } else {
        list[msg.guild.id].link.push('INVALID')
        list[msg.guild.id].info.push('INVALID')
        list[msg.guild.id].requester.push('INVALID')
        Logger.debug('Playlist debug, ' + err)
        return reject(first)
      }
    })
  })
}
