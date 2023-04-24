'use strict'

const fp = require('fastify-plugin')

/**
 * Every request creates a new child logger based on:
 * - the unique main logger
 * - the route's configuration/context
 */

async function fastifyLogController (fastify, opts) {
  const {
    optionKey = 'logCtrl',
    routeConfig
  } = opts

  const pocket = new Map()

  // Inspired by https://github.com/Eomm/fastify-explorer
  fastify.addHook('onRegister', function fastifyExplorerTracker (instance, opts) {
    const pluginId = opts?.[optionKey]?.name
    if (pluginId) {
      if (pocket.has(pluginId)) {
        throw new Error(`The instance named ${pluginId} has been already registerd`)
      }

      const defaultLogLevel = opts.logLevel || instance.log.level
      pocket.set(pluginId, defaultLogLevel) // save the initial log level

      // todo manage the case where the route has a specific log level
      instance.addHook('onRequest', logLevelHook.bind(instance, pluginId))
    }
  })

  const logLevels = Object.keys(fastify.log.levels.values)

  fastify.post('/log-level', {
    ...routeConfig,
    handler: logLevelControllerHandler,
    schema: {
      body: {
        type: 'object',
        required: ['level', 'contextName'],
        properties: {
          level: { type: 'string', enum: logLevels },
          contextName: { type: 'string', minLength: 1, maxLength: 500 }
        }
      }
    }
  })

  function logLevelHook (pluginId, request, reply, done) {
    if (!request.routeOptions.logLevel &&
      request.log.level !== pocket.get(pluginId)) {
      request.log.level = pocket.get(pluginId)
    }
    done()
  }

  function logLevelControllerHandler (request, reply) {
    const instance = pocket.get(request.body.contextName)
    if (!instance) {
      reply.code(404).send(new Error('Context not found'))
      return
    }

    pocket.set(request.body.contextName, request.body.level)
    reply.code(204).send()
  }
}

module.exports = fp(fastifyLogController, {
  name: 'fastify-log-controller',
  fastify: '^4'
})

module.exports.default = fastifyLogController
module.exports.fastifyLogController = fastifyLogController
