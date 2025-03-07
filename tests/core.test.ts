import { makeExecutableSchema } from '@graphql-tools/schema'
import { graphql, subscribe, parse } from 'graphql'
import { $$asyncIterator } from 'iterall'
import { ExecutionResult } from 'apollo-link'

import { applyMiddleware } from '../src'
import {
  IResolvers,
  IMiddlewareTypeMap,
  IMiddlewareFunction,
} from '../src/types'

describe('core:', () => {
  /* Schema. */

  const typeDefs = `
    type Query {
      before(arg: String!): String!
      beforeNothing(arg: String!): String!
      after: String!
      afterNothing: String!
      null: String
      nested: Nothing!
      resolverless: Resolverless!
    }

    type Subscription {
      sub: String
      subWithResolve: String
    }

    type Nothing {
      nothing: String!
    }

    type Resolverless {
      someData: String!
    }

    schema {
      query: Query,
      subscription: Subscription
    }
  `

  const resolvers: IResolvers = {
    Query: {
      before: (parent, { arg }, ctx, info) => arg,
      beforeNothing: (parent, { arg }, ctx, info) => arg,
      after: () => 'after',
      afterNothing: () => 'after',
      null: () => null,
      nested: () => ({}),
      resolverless: () => ({ someData: 'data' }),
    },
    Subscription: {
      sub: {
        subscribe: async (parent, { arg }, ctx, info) => {
          const iterator = {
            next: () => Promise.resolve({ done: false, value: { sub: arg } }),
            return: () => {
              return
            },
            throw: () => {
              return
            },
            [$$asyncIterator]: () => iterator,
          }
          return iterator
        },
      },
      subWithResolve: {
        subscribe: async (parent, { arg }, ctx, info) => {
          const iterator = {
            next: () => Promise.resolve({ done: false, value: { subWithResolve: arg } }),
            return: () => {
              return
            },
            throw: () => {
              return
            },
            [$$asyncIterator]: () => iterator,
          }
          return iterator
        },
        resolve: (parent, { arg }, ctx, info) => arg
      },
    },
    Nothing: {
      nothing: () => 'nothing',
    },
  }

  const getSchema = () => makeExecutableSchema({ typeDefs, resolvers })

  // Field Middleware

  // Type Middleware

  const typeMiddlewareBefore: IMiddlewareTypeMap = {
    Query: async (resolve, parent, args, context, info) => {
      const _args = { arg: 'changed' }
      return resolve(parent, _args)
    },
    Subscription: async (resolve, parent, args, context, info) => {
      const _args = { arg: 'changed' }
      return resolve(parent, _args)
    },
  }

  const typeMiddlewareAfter: IMiddlewareTypeMap = {
    Query: async (resolve, parent, args, context, info) => {
      const res = resolve()
      return 'changed'
    },
  }

  // Schema Middleware

  const schemaMiddlewareBefore: IMiddlewareFunction = async (
    resolve,
    parent,
    args,
    context,
    info,
  ) => {
    const _args = { arg: 'changed' }
    return resolve(parent, _args, context, info)
  }

  const schemaMiddlewareAfter: IMiddlewareFunction = async (
    resolve,
    parent,
    args,
    context,
    info,
  ) => {
    const res = resolve()
    return 'changed'
  }

  const emptyStringMiddleware: IMiddlewareFunction = async (
    resolve,
    parent,
    args,
    context,
    info,
  ) => {
    if (/^String!?$/.test(String(info.returnType))) {
      return ''
    } else {
      return resolve()
    }
  }

  test('field middleware', async () => {
    const schema = getSchema()
    const fieldMiddleware: IMiddlewareTypeMap = {
      Query: {
        before: async (resolve, parent) => {
          const _args = { arg: 'changed' }
          return resolve(parent, _args)
        },
        after: async (resolve) => {
          return 'changed'
        },
      },
    }
    const schemaWithMiddleware = applyMiddleware(schema, fieldMiddleware)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'before',
        after: 'changed',
        afterNothing: 'after',
        null: null,
        nested: { nothing: 'nothing' },
      },
    })
  })

  test('field middleware subscriptions', async () => {
    const schema = getSchema()

    const fieldMiddleware: IMiddlewareTypeMap = {
      Subscription: {
        sub: async (resolve, parent, args, context, info) => {
          const _args = { arg: 'changed' }
          return resolve(parent, _args)
        },
      },
    }
    const schemaWithMiddleware = applyMiddleware(schema, fieldMiddleware)

    const query = `
      subscription {
        sub
      }
    `
    const iterator = await subscribe(schemaWithMiddleware, parse(query))
    const res = await (iterator as AsyncIterator<ExecutionResult>).next()

    /* Tests. */

    expect(res).toEqual({
      done: false,
      value: {
        data: {
          sub: 'changed',
        },
      },
    })
  })

  test('type middleware before', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, typeMiddlewareBefore)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'changed',
        after: 'after',
        afterNothing: 'after',
        null: null,
        nested: { nothing: 'nothing' },
      },
    })
  })

  test('type middleware after', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, typeMiddlewareAfter)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'changed',
        after: 'changed',
        afterNothing: 'changed',
        null: 'changed',
        nested: { nothing: 'nothing' },
      },
    })
  })

  test('type middleware subscriptions', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, typeMiddlewareBefore)

    const query = `
      subscription {
        sub
      }
    `
    const iterator = await subscribe(schemaWithMiddleware, parse(query))
    const res = await (iterator as AsyncIterator<ExecutionResult>).next()

    expect(res).toEqual({
      done: false,
      value: {
        data: {
          sub: 'changed',
        },
      },
    })
  })

  test('schema middleware before', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, schemaMiddlewareBefore)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'changed',
        after: 'after',
        afterNothing: 'after',
        null: null,
        nested: { nothing: 'nothing' },
      },
    })
  })

  test('schema middleware after', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, schemaMiddlewareAfter)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'changed',
        after: 'changed',
        afterNothing: 'changed',
        null: 'changed',
        nested: { nothing: 'changed' },
      },
    })
  })

  test('schema middleware before', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, schemaMiddlewareBefore)

    const query = `
      query {
        before(arg: "before")
        beforeNothing(arg: "before")
        after
        afterNothing
        null
        nested { nothing }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    /* Tests. */

    expect(res).toEqual({
      data: {
        before: 'changed',
        beforeNothing: 'changed',
        after: 'after',
        afterNothing: 'after',
        null: null,
        nested: { nothing: 'nothing' },
      },
    })
  })

  test('schema middleware subscription', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, schemaMiddlewareBefore)

    const query = `
      subscription {
        sub
      }
    `
    const iterator = await subscribe(schemaWithMiddleware, parse(query))
    const res = await (iterator as AsyncIterator<ExecutionResult>).next()

    expect(res).toEqual({
      done: false,
      value: {
        data: {
          sub: 'changed',
        },
      },
    })
  })

  test('schema middleware uses default field resolver', async () => {
    const schema = getSchema()
    const schemaWithMiddleware = applyMiddleware(schema, schemaMiddlewareBefore)

    const query = `
      query {
        resolverless {
          someData
        }
      }
    `
    const res = await graphql(schemaWithMiddleware, query)

    expect(res).toEqual({
      data: {
        resolverless: {
          someData: 'data',
        },
      },
    })
  })

  test('middleware subscriptions with declared resolver', async () => {
    const schema = getSchema()

    const fieldMiddleware: IMiddlewareTypeMap = {
      Subscription: {
        sub: async (resolve, parent, args, context, info) => {
          const _args = { arg: 'changed' }
          throw Error('threw in middleware')
        },
        subWithResolve: async (resolve, parent, args, context, info) => {
          const _args = { arg: 'changed' }
          throw Error('threw in middleware')
        },
      },
    }
    const schemaWithMiddleware = applyMiddleware(schema, fieldMiddleware)

    const query = `
      subscription {
        sub
      }
    `
    const queryResolve = `
      subscription {
        subWithResolve
      }
    `
    const iterator = await subscribe(schemaWithMiddleware, parse(query))

    const iteratorResolve = await subscribe(schemaWithMiddleware, parse(queryResolve))

    /* Tests. */

    expect((iterator as ExecutionResult).errors[0].message).toEqual('threw in middleware')

    expect((iteratorResolve as ExecutionResult).errors[0].message).toEqual('threw in middleware')

  })
})
