'use strict'

const fp = require('fastify-plugin')
const fastifyExplorer = require('fastify-explorer')

async function fastifyLogController (fastify, opts) {
  fastify.register(fastifyExplorer, { optionKey: 'logCtrl' })

  const logLevels = Object.keys(fastify.log.levels.values)

  fastify.post('/log-level', {
    handler: logLevelController,
    schema: {
      body: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: logLevels },
          contextName: { type: 'string', minLength: 1, maxLength: 500 }
        }
      }
    }
  })
}

function logLevelController (request, reply) {
  const instance = this.giveMe(request.body.contextName)

  if (!instance) {
    reply.code(404).send({ error: 'Context not found' })
    return
  }

  instance.log.level = request.body.level
  reply.code(204).send()
}

module.exports = fp(fastifyLogController, {
  name: 'fastify-log-controller',
  fastify: '^4'
})

module.exports.default = fastifyLogController
module.exports.fastifyLogController = fastifyLogController
