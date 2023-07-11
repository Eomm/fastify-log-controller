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

  app.register(plugin)

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

  {
    const res = await getLogLevels(app)
    t.equal(res.statusCode, 404)
  }

  {
    const res = await getCurrentLogLevels(app)
    t.equal(res.statusCode, 404)
  }
})

test('Does not overwrite plugin config', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: logStream.config
  })

  app.register(plugin)

  app.register(async function plugin (app) {
    app.get('/bar', (request, reply) => {
      request.log.debug('bar debug')
      request.log.fatal('bar fatal')
      return {}
    })
  }, {
    logLevel: 'fatal',
    logCtrl: { name: 'bar' }
  })

  const expected = []

  await triggerLog(t, app, '/bar')
  expected.push(...[
    'bar fatal'
  ])

  const res = await changeLogLevel(app, { level: 'trace', contextName: 'bar' })
  t.equal(res.statusCode, 204)
  await triggerLog(t, app, '/bar')
  expected.push(...[
    // 'bar debug',
    'bar fatal'
  ])

  t.same(logStream.messages(), expected)
})

test('Does not overwrite route config', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: logStream.config
  })

  app.register(plugin)

  app.register(async function plugin (app) {
    app.get('/bar', {
      logLevel: 'fatal',
      handler: (request, reply) => {
        request.log.trace('bar trace')
        request.log.fatal('bar fatal')
        return {}
      }
    })
  }, { logCtrl: { name: 'bar' } })

  const expected = []

  await triggerLog(t, app, '/bar')
  expected.push(...[
    'bar fatal'
  ])

  await changeLogLevel(app, { level: 'trace', contextName: 'bar' })
  await triggerLog(t, app, '/bar')
  expected.push(...[
    'bar fatal'
  ])

  t.same(logStream.messages(), expected)
})

test('Bad input', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: logStream.config
  })
  app.register(plugin)

  {
    const res = await changeLogLevel(app, { level: 'warn', contextName: 'bar' })
    t.same(res.json(), {
      statusCode: 404,
      error: 'Not Found',
      message: 'Context not found'
    })
  }

  {
    const res = await changeLogLevel(app, { level: 'what', contextName: 'bar' })
    t.equal(res.statusCode, 400)
  }

  {
    const res = await changeLogLevel(app, { level: 'info' })
    t.equal(res.statusCode, 400)
  }

  {
    const res = await changeLogLevel(app, { level: 'info', contextName: 'x'.repeat(1000) })
    t.equal(res.statusCode, 400)
  }
})

test('Bad usage', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: logStream.config
  })
  app.register(plugin)

  app.register(async function plugin (app, opts) {
    // none
  }, { logCtrl: { name: 'foo' } })

  app.register(async function plugin (app, opts) {
    // none
  }, { logCtrl: { name: 'foo' } })

  try {
    await app.ready()
    t.fail('should throw')
  } catch (error) {
    t.ok(error)
    t.equal(error.message, 'The instance named foo has been already registered')
  }
})

test('Custom log levels', async (t) => {
  const logStream = buildTestLogger()
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      ...logStream.config,
      customLevels: {
        trentatre: 33,
        foo: 42
      }
    }
  })

  app.register(plugin, { exposeGet: true })

  app.register(async function plugin (app) {
    app.get('/bar', (request, reply) => {
      request.log.trace('bar trace')
      request.log.debug('bar debug')
      request.log.info('bar info')
      request.log.trentatre('bar 33')
      request.log.warn('bar warn')
      request.log.foo('bar foo') // 42
      request.log.error('bar error')
      request.log.fatal('bar fatal')
      return {}
    })
  }, { logCtrl: { name: 'bar' } })

  const expected = []

  await triggerLog(t, app, '/bar')
  expected.push(...[
    'bar trace',
    'bar debug',
    'bar info',
    'bar 33',
    'bar warn',
    'bar foo',
    'bar error',
    'bar fatal'
  ])

  const res = await changeLogLevel(app, { level: 'foo', contextName: 'bar' })
  t.equal(res.statusCode, 204)

  await triggerLog(t, app, '/bar')
  expected.push(...[
    'bar foo',
    'bar error',
    'bar fatal'
  ])

  t.same(logStream.messages(), expected)

  {
    const res = await changeLogLevel(app, { level: 'baz', contextName: 'bar' })
    t.equal(res.statusCode, 400)
  }

  {
    const res = await getLogLevels(app)
    t.equal(res.statusCode, 200)
    t.same(res.json(), ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'trentatre', 'foo'])
  }

  {
    const res = await getCurrentLogLevels(app)
    t.equal(res.statusCode, 200)
    t.same(res.json(), [{ contextName: 'bar', level: 'foo' }])
  }
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

function getLogLevels (app) {
  return app.inject({
    method: 'GET',
    url: '/log-level/levels'
  })
}

function getCurrentLogLevels (app) {
  return app.inject({
    method: 'GET',
    url: '/log-level'
  })
}
