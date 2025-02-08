const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const { z } = require('zod')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@clickhouse/client')
const { Kafka } = require('kafkajs')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 9000

const prisma = new PrismaClient({})

const io = new Server({ cors: '*' })

const kafka = new Kafka({
  clientId: `api-server`,
  brokers: ['kafka-2ce29424-vercel-clone-divyansh.f.aivencloud.com:10044'],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')],
  },
  sasl: {
    username: '',
    password: '',
    mechanism: 'plain',
  },
})

const client = createClient({
  host: 'https://avnadmin:@clickhouse-15020db1-vercel-clone-divyansh.c.aivencloud.com:10032',
  database: 'default',
  username: '',
  password: '',
})

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })

io.on('connection', (socket) => {
  socket.on('subscribe', (channel) => {
    socket.join(channel)
    socket.emit('message', JSON.stringify({ log: `Subscribed to ${channel}` }))
  })
})

io.listen(9001, () => console.log('Socker Server 9001'))

app.use(express.json())
app.use(cors())

const ecsClient = new ECSClient({
  credentials: {
    accessKeyId: '',
    secretAccessKey: '/d',
  },
})

const config = {
  CLUSTER: 'arn:aws:ecs:ap-south-1:361769584339:cluster/builder-cluster',
  TASK: 'arn:aws:ecs:ap-south-1:361769584339:task-definition/builder-task',
}

app.post('/project', async (req, res) => {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string(),
  })
  const safePArseResult = schema.safeParse(req.body)

  if (safePArseResult.error)
    return res.status(400).json({ error: safePArseResult.error.errors })

  const { name, gitURL } = safePArseResult.data

  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subDomain: generateSlug(),
    },
  })

  return res.json({ status: 'success', data: { project } })
})

app.post('/deploy', async (req, res) => {
  const { projectId } = req.body
  const project = await prisma.project.findUnique({ where: { id: projectId } })

  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  // Check if there is no running deployement
  const deployment = await prisma.deployment.create({
    data: {
      project: { connect: { id: projectId } },
      status: 'QUEUED',
    },
  })

  // Spin the container
  const command = new RunTaskCommand({
    region: 'ap-south-1',
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: 'FARGATE',
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: [
        ],
        securityGroups: [''],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: 'builder-image',
          environment: [
            {
              name: 'GIT_REPOSITORY__URL',
              value: project.gitURL,
            },
            {
              name: 'PROJECT_ID',
              value: projectId,
            },
            {
              name: 'DEPLOYMENT_ID',
              value: deployment.id,
            },
          ],
        },
      ],
    },
  })

  await ecsClient.send(command)

  return res.json({
    status: 'queued',
    data: { deploymentId: deployment.id },
  })
})

app.get('/logs/:id', async (req, res) => {
  const id = req.params.id
  const logs = await client.query({
    query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
    query_params: {
      deployment_id: id,
    },
    format: 'JSONEachRow',
  })

  const rawLogs = await logs.json()

  return res.json({ logs: rawLogs })
})

async function initkafkaConsumer() {
  await consumer.connect()
  await consumer.subscribe({ topics: ['container-logs'], fromBeginning: true })

  await consumer.run({
    autoCommit: false,
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages
      console.log(`Recv. ${messages.length} messages..`)
      for (const message of messages) {
        if (!message.value) continue
        const stringMessage = message.value.toString()
        const { DEPLOYMENT_ID, log } = JSON.parse(stringMessage)
        try {
          const { query_id } = await client.insert({
            table: 'log_events',
            values: [
              {
                event_id: uuidv4(),
                deployment_id: DEPLOYMENT_ID,
                log,
              },
            ],
            format: 'JSONEachRow',
          })
          resolveOffset(message.offset)
          await commitOffsetsIfNecessary(message.offset)
          await heartbeat()
          console.log(`Inserted query_id: ${query_id}`)
        } catch (error) {
          console.error(`Error: ${error.message}`)
        }
      }
    },
  })
}

initkafkaConsumer()

app.listen(PORT, () => {
  console.log(`API Server Running... ${PORT}`)
})
