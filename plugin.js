'use strict'

const fp = require('fastify-plugin')

function fastifyLogController (fastify, opts, next) {
  fastify.get('/log', (request, reply) => {
    reply.send({ hello: 'world' })
  })

  next()
}

module.exports = fp(fastifyLogController, {
  name: 'fastify-log-controller',
  fastify: '^4'
})
