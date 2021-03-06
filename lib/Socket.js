'use strict';

var util = require('util');
var ut = require('utjs');

var Serializer = require('./Serializer');
var Sock = require('./Sock');

/**
 * Client socket.
 *
 * @param {Object} [opts] The Sock and net.Socket options.
 * @param {Boolean} [opts.reconnect=true] Enable or disable the reconnection.
 * @param {Number} [opts.reconnectInterval=1000] The reconnection interval.
 * @param {Boolean} [opts.autoConnect=true] Enable or disable the
 *        auto connection after instance the class.
 * @param {Boolean} [opts.useQueue=true] Enable or disable the usage of an internal
 *        queue that will containt the emitted messages while the socket isn't
 *        connected. The enqueued messages will be sent as soon as the socket
 *        is connected.
 * @param {Number} [opts.queueSize=Infinity] The max size of the queue. If the queue is
 *        full, new messages will be added and the oldest will be removed.
 * @param {Number} [opts.timeout=0] Sets the socket to timeout after opts.timeout milliseconds
 *                                  of inactivity on the socket. When an idle timeout is triggered
 *                                  the socket will emit an 'error' event and the connection
 *                                  will be destroyed. If timeout is 0, then the existing idle timeout
 *                                  is disabled.
 * @constructor
 * @augments Sock
 * @fires Socket#connect
 * @fires Socket#reconnecting
 * @fires Socket#socket_connect
 * @fires Socket#end
 * @fires Socket#close
 * @fires Socket#error
 */
function Socket(opts) {
  opts.messageListener = this._msgListener;
  Socket.super_.call(this, opts);
}

util.inherits(Socket, Sock);

/**
 * Emit an event.
 *
 * @param  {String} event The event name.
 * @param  {String|Number|Object|Buffer} data The data to send.
 * @param  {Object|Function} [param] The options or callback.
 * @param  {String[]} [param.sockets=[]] The list of socket ids to send.
 * @param  {String[]} [param.rooms=[]] The list of rooms to send.
 * @param  {Boolean} [param.broadcast=false] Send to all connected sockets.
 */
Socket.prototype.emit = function (event, data, param) {
  var opts = ut.isObject(param) ? param : {};
  var cb = ut.isFunction(param) ? param : null;

  this._emit(event, data, opts, cb);
};

/**
 * Join to a room.
 *
 * @param  {String} room The room name.
 */
Socket.prototype.join = function (room) {
  this._send('', room, Serializer.MT_JOIN_ROOM);
};

/**
 * Leave a room.
 *
 * @param  {String} room The room name.
 */
Socket.prototype.leave = function (room) {
  this._send('', room, Serializer.MT_LEAVE_ROOM);
};

/**
 * Leave all rooms.
 */
Socket.prototype.leaveAll = function () {
  this._send('', '', Serializer.MT_LEAVE_ALL_ROOMS);
};

Socket.prototype._emit = function (event, data, opts, cb) {
  var socketIds = ut.isArray(opts.sockets) ? opts.sockets : [];
  var rooms = ut.isArray(opts.rooms) ? opts.rooms : [];
  var broadcast = ut.isBoolean(opts.broadcast) ? opts.broadcast : false;

  if (broadcast) {
    this._send(event, data, Serializer.MT_DATA_BROADCAST);
  }

  if (socketIds.length > 0) {
    this._send(socketIds.join(',') + ':' + event, data, Serializer.MT_DATA_TO_SOCKET);
  }

  if (rooms.length > 0) {
    this._send(rooms.join(',') + ':' + event, data, Serializer.MT_DATA_TO_ROOM);
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

Socket.prototype._msgListener = function (msg) {
  switch (msg.mt) {
    case Serializer.MT_REGISTER:
      this.id = msg.data;

      /**
       * The socket is connected and registered so {@link Socket#id}
       * now contains the socket identification.
       *
       * @event Socket#connect
       */
      this._superEmit('connect');
  }
};

module.exports = Socket;
