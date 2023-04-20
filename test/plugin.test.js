'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const split = require('split2')

const plugin = require('../plugin')

test('Basic usage', async (t) => {
  const logStream = split(JSON.parse)
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      stream: logStream
    }
  })

  logStream.on('data', line => {
    console.log(line)
  })

  app.register(plugin)

  app.register(async function plugin (app) {
    app.get('/bar', (request, reply) => {
      request.log.trace('bar trace')
      request.log.debug('bar debug')
      request.log.info('bar info')
      request.log.warn('bar warn')
      request.log.error('bar error')
      return {}
    })
  }, { logCtrl: { name: 'one' } })

  app.register(async function plugin (app, opts) {
    app.get('/foo', (request, reply) => {
      request.log.trace('foo trace')
      request.log.debug('foo debug')
      request.log.info('foo info')
      request.log.warn('foo warn')
      request.log.error('foo error')
      return {}
    })
  }, { logCtrl: { name: 'two' } })

  app.register(async function plugin (app, opts) {
    app.get('/none', (request, reply) => {
      request.log.trace('none trace')
      request.log.debug('none debug')
      request.log.info('none info')
      request.log.warn('none warn')
      request.log.error('none error')
      return {}
    })
  })

  const res = await app.inject({
    method: 'POST',
    url: '/log-level',
    body: {
      level: 'warn',
      contextName: 'one'
    }
  })
  t.equal(res.statusCode, 204)

  const res2 = await app.inject('/bar')
  t.equal(res2.statusCode, 200)
  // for await (const line of logStream) {
  //   console.log(line)
  // }

  // {
  //   const line = await once(logStream, 'data')
  //   console.log(line)
  // }
  // {
  //   const line = await once(logStream, 'data')
  //   console.log(line)
  // }
})
