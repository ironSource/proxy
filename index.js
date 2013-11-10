
var _ = require('lodash');
var async = require('async');
var net = require('net');
var rc = require('rc');
var log4js = require('log4js');

var logger = log4js.getLogger('proxy');

//

function Proxy() {
	var logger = log4js.getLogger('Proxy');
	logger.setLevel('ERROR');
	this._logger = logger;
}

var p = Proxy.prototype;

p.start = function() {
	this._logger.trace('start');
	var server = net.createServer();
	server.on('connection', _.bind(this._onConnection, this));
	server.listen(conf.port, conf.host);
};

p._onConnection = function(socket) {
	this._logger.trace('_onConnection');
	var proxyConnection = new ProxyConnection(socket);
	proxyConnection.start();
};

delete p;

//

function ProxyConnection(socket) {
	var logger = log4js.getLogger('ProxyConnection');
	logger.setLevel('ERROR');
	this._logger = logger;
	this._socket = socket;
	this._devSocket = null;
	this._prodSocket = null;
	this._prodState = 'offline';
	this._devState = 'offline';
	this._writeBound = _.bind(this._write, this);
	this._readFromProdBound = _.bind(this._readFromProd, this);
	this._readFromDevBound = _.bind(this._readFromDev, this);
	this._prodSocketOnceDrainBound = null;
	this._devSocketOnceDrainBound = null;
}

var p = ProxyConnection.prototype;

p.start = function() {
	this._logger.trace('start');
	this._connectToProd();
	this._connectToDev();
	this._socket.on('end', _.bind(this._onSocketEnd, this));
	this._socket.on('error', _.bind(this._onSocketError, this));
};

p._onSocketEnd = function() {
	this._logger.trace('_onSocketEnd');
};

p._onSocketError = function() {
	this._logger.trace('_onSocketError');
};

p._connectToProd = function() {
	this._logger.trace('_connectToProd');
	var prodSocket = net.createConnection(conf.prod.port, conf.prod.host);
	this._prodSocket = prodSocket;
	this._prodSocketOnceDrainBound = _.bind(prodSocket.once, prodSocket, 'drain');
	prodSocket.on('connect', _.bind(this._onProdConnect, this));
	prodSocket.on('error', _.bind(this._onProdSocketError, this));
	prodSocket.on('end', _.bind(this._onProdSocketEnd, this));
};

p._onProdConnect = function() {
	this._prodState = 'online';
	var devState = this._devState;
	if (devState === 'online' || devState === 'error') {
		this._startIo();
	}
};

p._onProdSocketError = function(err) {
	this._logger.trace('_onProdSocketError');
	this._logger.error(err);
	this._socket.end();
};

p._onProdSocketEnd = function() {
	this._logger.trace('_onProdSocketEnd');
	this._socket.end();
};

p._connectToDev = function() {
	this._logger.trace('_connectToDev');
	var devSocket = net.createConnection(conf.dev.port, conf.dev.host);
	this._devSocket = devSocket;
	this._devSocketOnceDrainBound = _.bind(devSocket.once, devSocket, 'drain');
	devSocket.on('connect', _.bind(this._onDevConnect, this));
	devSocket.on('error', _.bind(this._onDevSocketError, this));
	devSocket.on('end', _.bind(this._onDevSocketEnd, this));
};

p._onDevSocketEnd = function() {
	this._logger.trace('_onDevSocketEnd');
	this._devState = 'error';
}

p._onDevConnect = function() {
	this._logger.trace('_onDevConnect');
	this._devState = 'online';
	var prodState = this._prodState;
	if (prodState === 'online') {
		this._startIo();
	}
};

p._onDevSocketError = function(err) {
	this._logger.trace('_onDevSocketError');
	this._logger.error(err);
	this._devState = 'error';
	if (this._prodState === 'online') {
		this._startIo();
	}
};

p._startIo = function() {
	this._logger.trace('_startIo');
	this._write();
	this._readFromProd();
	this._readFromDev();
};

p._write = function() {
	this._logger.trace('_write');
	var socket = this._socket;
	var prodSocket = this._prodSocket;
	var devSocket = this._devSocket;
	var tasks = [];
	for (;;) {
		var buff = socket.read();
		if (buff === null) {
			socket.once('readable', this._writeBound);
			return;
		}
		if (!prodSocket.write(buff)) {
			tasks.push(this._prodSocketOnceDrainBound);
		}
		if (this._devState === 'online' && !devSocket.write(buff)) {
			tasks.push(this._devSocketOnceDrainBound);
		}
		if (tasks.length !== 0) {
			async.parallel(tasks, this._writeBound);
			return;
		}
	}
};

p._readFromProd = function() {
	this._logger.trace('_readFromProd');
	var prodSocket = this._prodSocket;
	var socket = this._socket;
	for (;;) {
		var buff = prodSocket.read();
		if (buff === null) {
			prodSocket.once('readable', this._readFromProdBound);
			return;
		}
		if (!socket.write(buff)) {
			socket.once('drain', this._readFromProdBound);
			return;
		}
	}
};

p._readFromDev = function() {
	this._logger.trace('_readFromDev');
	var devSocket = this._devSocket;
	while (devSocket.read() !== null);
	devSocket.once('readable', this._readFromDevBound);
};

delete p;

//

var conf = rc('proxy', {
	port: 2803,
	prod: {
		port: 80,
		host: 'localhost'
	},
	dev: {
		port: 81,
		host: 'localhost'
	}
});

var proxy = new Proxy();
proxy.start();
