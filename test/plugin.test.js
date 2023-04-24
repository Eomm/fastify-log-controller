'use strict'

const { test } = require('tap')
const split = require('split2')

const Fastify = require('fastify')
const pino = require('pino')

const plugin = require('../plugin')

function buildTestLogger () {
  const logStream = split(JSON.parse)

  const buffer = []
  logStream.on('data', line => {
    buffer.push(line)
  })

  return {
    config: {
      level: 'trace',
      stream: pino.multistream([
        {
          level: 'trace',
          stream: logStream
        }
      ])
    },
    buffer,
    messages () {
      return buffer.map(line => line.msg)
    }
  }
}

test('Basic usage', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: logStream.config
  })

  await app.register(plugin)

  app.register(async function plugin (app) {
    app.get('/bar', (request, reply) => {
      request.log.trace('bar trace')
      request.log.debug('bar debug')
      request.log.info('bar info')
      request.log.warn('bar warn')
      request.log.error('bar error')
      request.log.fatal('bar fatal')
      return {}
    })
  }, { logCtrl: { name: 'bar' } })

  app.register(async function plugin (app, opts) {
    app.get('/foo', (request, reply) => {
      request.log.trace('foo trace')
      request.log.debug('foo debug')
      request.log.info('foo info')
      request.log.warn('foo warn')
      request.log.error('foo error')
      request.log.fatal('foo fatal')
      return {}
    })
  }, { logCtrl: { name: 'foo' } })

  app.register(async function plugin (app, opts) {
    app.get('/none', (request, reply) => {
      request.log.trace('none trace')
      request.log.debug('none debug')
      request.log.info('none info')
      request.log.warn('none warn')
      request.log.error('none error')
      request.log.fatal('none fatal')
      return {}
    })
  })

  const expected = []

  const res = await changeLogLevel(app, { level: 'warn', contextName: 'bar' })
  t.equal(res.statusCode, 204)
  await triggerLog(t, app, '/bar')
  await triggerLog(t, app, '/foo')
  await triggerLog(t, app, '/none')
  expected.push(...[
    'bar warn',
    'bar error',
    'bar fatal',
    'foo trace',
    'foo debug',
    'foo info',
    'foo warn',
    'foo error',
    'foo fatal',
    'none trace',
    'none debug',
    'none info',
    'none warn',
    'none error',
    'none fatal'
  ])

  await changeLogLevel(app, { level: 'debug', contextName: 'bar' })
  await triggerLog(t, app, '/bar')
  await triggerLog(t, app, '/foo')
  await triggerLog(t, app, '/none')
  expected.push(...[
    'bar debug',
    'bar info',
    'bar warn',
    'bar error',
    'bar fatal',
    'foo trace',
    'foo debug',
    'foo info',
    'foo warn',
    'foo error',
    'foo fatal',
    'none trace',
    'none debug',
    'none info',
    'none warn',
    'none error',
    'none fatal'
  ])

  await changeLogLevel(app, { level: 'error', contextName: 'bar' })
  await changeLogLevel(app, { level: 'error', contextName: 'foo' })
  await triggerLog(t, app, '/bar')
  await triggerLog(t, app, '/foo')
  await triggerLog(t, app, '/none')
  expected.push(...[
    'bar error',
    'bar fatal',
    'foo error',
    'foo fatal',
    'none trace',
    'none debug',
    'none info',
    'none warn',
    'none error',
    'none fatal'
  ])

  t.same(logStream.messages(), expected)
})

async function triggerLog (t, app, url) {
  const res = await app.inject({
    method: 'GET',
    url
  })
  t.equal(res.statusCode, 200)
  return res
}

function changeLogLevel (app, body) {
  return app.inject({
    method: 'POST',
    url: '/log-level',
    body
  })
}
