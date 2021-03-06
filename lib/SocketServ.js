'use strict';

var util = require('util');
var ut = require('utjs');

var Serializer = require('./Serializer');
var Sock = require('./Sock');

function SocketServ(id, socket, server) {
  SocketServ.super_.call(this, {
    autoConnect: false,
    reconnect: false,
    useQueue: false,
    messageListener: this._msgListener
  });

  // Sock fields
  this.id = id;
  this._socket = socket;
  this._connected = true;

  this._server = server;
  this._rooms = {};

  this._bindEvents();
}

util.inherits(SocketServ, Sock);

SocketServ.prototype.emit = function (event, data, param) {
  var opts = ut.isObject(param) ? param : {};
  var cb = ut.isFunction(param) ? param : null;

  this._emit(event, data, opts, cb);
};

SocketServ.prototype.join = function (room) {
  this._server.join(room, this.id);
};

SocketServ.prototype.leave = function (room) {
  this._server.leave(room, this.id);
};

SocketServ.prototype.leaveAll = function () {
  this._server.leaveAll(this.id);
};

SocketServ.prototype._emit = function (event, data, opts, cb) {
  var socketIds = ut.isArray(opts.sockets) ? opts.sockets : [];
  var rooms = ut.isArray(opts.rooms) ? opts.rooms : [];
  var broadcast = ut.isBoolean(opts.broadcast) ? opts.broadcast : false;

  if (broadcast) {
    this._server.emit(event, data, { except: [this.id] });
  }

  if (socketIds.length > 0) {
    this._server.emit(event, data, { sockets: socketIds });
  }

  if (rooms.length > 0) {
    this._server.emit(event, data, { rooms: rooms, except: [this.id] });
  }

  if (socketIds.length + rooms.length === 0 && !broadcast) {
    opts = {};
    var mt = Serializer.MT_DATA;

    if (cb !== null) {
      opts.cb = cb;
      mt = Serializer.MT_DATA_WITH_ACK;
    }

    this._send(event, data, mt, opts);
  }
};

SocketServ.prototype._msgListener = function (msg) {
  var arr;

  switch (msg.mt) {
    case Serializer.MT_JOIN_ROOM:
      this.join(msg.data);
      break;
    case Serializer.MT_LEAVE_ROOM:
      this.leave(msg.data);
      break;
    case Serializer.MT_LEAVE_ALL_ROOMS:
      this.leaveAll();
      break;
    case Serializer.MT_DATA_BROADCAST:
      this.emit(msg.event, msg.data, { broadcast: true });
      break;
    case Serializer.MT_DATA_TO_ROOM:

      // [0] = rooms, [1] = event
      arr = msg.event.split(':');
      this.emit(arr[1], msg.data, { rooms: arr[0].split(',') });
      break;
    case Serializer.MT_DATA_TO_SOCKET:

      // [0] = socketIds, [1] = event
      arr = msg.event.split(':');
      this.emit(arr[1], msg.data, { sockets: arr[0].split(',') });
  }
};

module.exports = SocketServ;
