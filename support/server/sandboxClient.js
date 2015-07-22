var connect = require('connect'),
    parseSignedCookie = connect.utils.parseSignedCookie,
    cookie = require('express/node_modules/cookie');
var sessions = require('./sessions.js');


var sandboxClient = function(socket)
{
    this.events = {};
    this.world = null;
    this.socket = socket;
    this.id = socket.id;
    this.loginData = socket.loginData;
    this.on = function(name, callback)
    {
        if (!this.events[name])
            this.events[name] = [];
        this.events[name].push(callback)
    }
    this.removeListener = function(name, callback)
    {
        if (!this.events[name]) return;
        var index = this.events[name].indexOf(callback)
        if (index != -1)
            this.events[name].splice(index, 1);
    }
    this.disconnect = function()
    {
        this.socket.disconnect();
    }
    this.trigger = function(name, e)
    {
        if (!this.events[name]) return;
        for (var i = 0; i < this.events[name].length; i++)
            this.events[name][i].apply(this, [e]);
    }
    this.setWorld = function(world)
    {
        this.world = world;
    }
    this.emit = function(type, message)
    {
        this.socket.emit(type, message);
    }

    var self = this;
    socket.on('authenticate', function(msg)
    {
        console.log(msg.cookie);
        try
        {
            var cookieData = parseSignedCookie(cookie.parse(msg.cookie.join(';'))[global.configuration.sessionKey ? global.configuration.sessionKey : 'virtual'],
                global.configuration.sessionSecret ? global.configuration.sessionSecret : 'unsecure cookie secret');
            logger.warn(cookieData);
            sessions.GetSessionData(
            {
                cookieData: cookieData
            }, function(loginData)
            {
                logger.warn('client changed credentials');
                console.log(loginData);
                self.loginData = loginData;
                self.trigger('authenticate');
            });
        }
        catch (e)
        {
            logger.error(e);
        }
    });
    socket.on('message', function(msg)
    {
        if (self.world)
            self.world.message(msg, self)
    });
    //When a client disconnects, go ahead and remove the instance data
    socket.on('disconnect', function()
    {
        if (self.world)
            self.world.disconnect(self);
    });

}


exports.sandboxClient = sandboxClient;