#!/usr/bin/env node

var sys = require('util');
var fs = require('fs');

var app = require('express').createServer();
var io = require('socket.io').listen(app);
io.set('log level', 1);

var MAXNICKLENGTH = 15;
var UID_LENGTH = 20;

var LISTEN_PORT = 4000;

var userlist = {};
var UID = {};
var clientbuf = {};
var nickbuf = {};

function getUsers() {
  users = [];
  for (key in userlist) {
    users.push(userlist[key]);
  }
  return users;
}

String.prototype.trim = function() {
  return this.replace(/^\s+|\s+$/g, "");
};

app.get('/', function(req, res) {
  var rs = fs.createReadStream(__dirname + '/streamchat.html');
  sys.pump(rs, res);
});

io.sockets.on('connection', function(client) {
  var nickname = "";

  if ('undefined' === typeof userlist[client.id]) {
    client.json.send({
      event : 'ERRAUTH',
      data : 'Not Logged In!'
    });
  }

  client.json.send({
    event : 'NOTIFY',
    data : '+++Welcome to Node Chat Server powered by nodejs! +++ Enter ' + 'nick name to continue'
  });

  client.on('message', function(message) {

    if ('undefined' === typeof userlist[client.id]) {
      var data = message.data;

      if (!(data.substr(-1).length === 0)) {
        nickbuf[client.id] = data;
      } else {
        if ('undefined' === typeof nickbuf[client.id]) {
          client.json.send({
            event : 'ERRAUTH',
            data : 'Not Logged In!'
          });
        } else {
          nickname = escape(nickbuf[client.id]).trim();
          delete nickbuf[client.id];

          if (nickname.match(/^[a-z][a-z0-9_|.\[\]\{\}`]+$/i)) {
            if (nickname.length > 15)
              nickname = nickname.substr(0, 15);

            client.json.send({
              event : 'NOTIFY',
              data : 'Welcome ' + nickname
            });
            io.sockets.json.send({
              event : 'NOTIFY',
              data : '>>> ' + nickname + ' joined.'
            });

            UID[client.id] = ((new Date()).getTime() + "" + Math
                .floor(Math.random() * 1000000)).substr(0, UID_LENGTH);
            userlist[client.id] = nickname;
            clientbuf[client.id] = new Buffer(1, 'ascii');

            client.json.send({
              event : 'NICK',
              data : nickname
            });

          } else {
            client.json.send({
              event : 'ERRNICK',
              data : 'Invalid Nickname!'
            });
          }
        }
      }
    } else {
      var clientevent = message.event;
      var data = message.data;

      if (data.match(/^\/me\ (.*)$/i)) { // check action pattern
        action = data.match(/^\/me\ (.*)$/i)[1];
        io.sockets.json.send('*' + nickname + ' ' + action);
      } else if (data.match(/^\/clear/i)) { // check action pattern
        client.json.send({
          event : 'CMD',
          data : 'clear'
        });
      } else if (data.match(/^\/nick\ ([a-z][a-z0-9_|.\[\]\{\}`]{1,14})$/i)) { // check
                                                                                // nick
                                                                                // change
                                                                                // pattern
        newnick = data.match(/^\/nick\ ([a-z][a-z0-9_|.\[\]\{\}`]+)$/i)[1];
        newnick = escape(newnick.trim());
        if (newnick.length > 15)
          newnick = newnick.substr(0, 15);
        oldnick = userlist[client.id];
        userlist[client.id] = newnick;
        client.json.send({
          event : 'NICK',
          data : newnick
        });
        io.sockets.json.send({
          event : 'NOTIFY',
          data : oldnick + ' is now known as ' + newnick
        });
      } else {
        io.sockets.json.send({
          event : 'MSG',
          uid : UID[client.id],
          data : '<' + userlist[client.id] + '> ' + data
        });
      }
    }

  });

  client.on('disconnect', function() {
    io.sockets.json.send({
      event : 'NOTIFY',
      data : '>>> ' + userlist[client.id] + ' has left.'
    });
    delete userlist[client.id];
    delete UID[client.id];
    delete clientbuf[client.id];
    delete nickbuf[client.id];
  });

  setInterval(function() {
    client.json.send({
      event : 'USERLIST',
      data : JSON.stringify(getUsers())
    });
  }, 2000);

});

app.listen(LISTEN_PORT);

