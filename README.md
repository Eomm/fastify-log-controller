# fastify-log-controller

[![Build Status](https://github.com/Eomm/fastify-log-controller/workflows/ci/badge.svg)](https://github.com/Eomm/fastify-log-controller/actions)
[![npm](https://img.shields.io/npm/v/fastify-log-controller)](https://www.npmjs.com/package/fastify-log-controller)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Control your application logs from your dashboard, at runtime!


## Install

```
npm i fastify-log-controller
```

### Compatibility

| Plugin version | Fastify version |
| ------------- |:---------------:|
| `^1.0.0` | `^4.0.0` |


## Usage

When you register this plugin, a new route will be available at `/log-level` (by default)
that allows you to change the log level of your application at runtime!

You will be able to change the log level for every tracked encapsulated context!

This is useful when you want to change the log level of your application without restarting it and
resetting what is in memory.

Let's see an example:

```js
async function example () {
  const app = require('fastify')({
    logger: {
      level: 'error'
    }
  })

  // Register the plugin
  app.register(require('fastify-log-controller'))

  const routes = async function plugin (app, opts) {
    app.get('/', async function handler (request, reply) {
      request.log.info('hello world')
      return { hello: 'world' }
    })
  }

  // Create an encapsulated context with register and set the `logCtrl` option
  app.register(routes, {
    logCtrl: { name: 'bar' }
  })

  // Check that the route doesn't log anything because the application log level is `error`
  await app.inject('/')

  // Change the log level of the `bar` context to `debug`
  await app.inject({
    method: 'POST',
    url: '/log-level',
    body: {
      level: 'debug',
      contextName: 'bar'
    }
  })

  // Check that the route logs the `hello world` message!
  await app.inject('/')
}

example()
```

Note that it works with [custom logger levels](https://github.com/pinojs/pino/blob/master/docs/api.md#customlevels-object) too!

If the `exposeGet` configuration option is set to `true`, the same route allows you to recover available contexts and currently set log levels:

```sh
$ curl http://localhost:3000/log-level
[{"contextName":"bar","level":"debug"}]
```

and the '/log-level/levels' route allows you to recover available log levels:

```sh
$ curl http://localhost:3000/log-level/levels
["trace","debug","info","warn","error","fatal"]
```

If you want to go deeper into the encapsulated context concept, you can read these sources:

- [YouTube Video](https://www.youtube.com/watch?v=BnnL7fAKqNU)
- [Complete Guide to Fastify plugin system](https://backend.cafe/the-complete-guide-to-the-fastify-plugin-system)
- [What is the exact use of `fastify-plugin`](https://stackoverflow.com/questions/61020394/what-is-the-exact-use-of-fastify-plugin/61054534#61054534)


### Known limitations

In fastify you can **voluntarily** set log level for every encapsulated context and route, but you can't change it at runtime.  
In these cases, the log level of the encapsulated context will be **preserved**.

#### Plugin log level

```js
app.register(async function plugin (app) {
  // The log level will be always `fatal`
}, {
  logLevel: 'fatal',
  logCtrl: { name: 'bar' }
})
```

#### Route log level

```js
app.register(async function plugin (app) {
  app.get('/bar', {
    logLevel: 'debug',
    handler: (request, reply) => {
      // Here the log level will be always `debug`
      return {}
    }
  })
  
  app.get('/bar', {
    handler: (request, reply) => {
      // Here the log level can be changed at runtime!
      return {}
    }
  })
}, { logCtrl: { name: 'foo' } })
```


## Options

You can pass some options to the plugin:

```js
app.register(require('fastify-log-controller'), {
  // How you want to call the option in the encapsulated context
  optionKey: 'logCtrl',

  // Enable get routes
  exposeGet: false,

  // Enhance the route config of the log controller route
  // It is not possible to change the handler and the schema
  routeConfig: {
    // Any option accepted by fastify route:
    // https://www.fastify.io/docs/latest/Reference/Routes/#routes-options
  }
})
```

Remember that you must pass the same `optionKey` to the encapsulated context:

```js
app.register(routes, {
  logCtrl: { name: 'bar' }
})
```


## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).