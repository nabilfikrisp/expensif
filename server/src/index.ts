import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from './pkg/env/env.js'

function createApp() {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello Hono asf!')
  })

  return app
}

const app = createApp()

serve({
  fetch: app.fetch,
  port: env.PORT
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port} (${env.NODE_ENV})`)
})
