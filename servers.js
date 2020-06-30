const express = require('express')
const http = require('http')
const socketio = require('socket.io')

const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

exports.app = app
exports.http_server = http_server
exports.io = io
