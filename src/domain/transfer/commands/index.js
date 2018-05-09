/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>
 --------------
 ******/

'use strict'

const Producer = require('@mojaloop/central-services-shared').Kafka.Producer
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Notification = require('../../../handlers/notification')
const Config = require('../../../lib/config')
const kafkaHost = process.env.KAFKA_HOST || Config.KAFKA_HOST || 'localhost'
const kafkaPort = process.env.KAFKA_BROKER_PORT || Config.KAFKA_BROKER_PORT || '9092'

const publishPrepare = async (headers, message) => {
  Logger.info('publishPrepare::start')
  const kafkaConfig = {
    rdkafkaConf: {
      'metadata.broker.list': `${kafkaHost}:${kafkaPort}`,
      'client.id': 'default-client',
      'event_cb': true,
      'compression.codec': 'none',
      'retry.backoff.ms': 100,
      'message.send.max.retries': 2,
      'socket.keepalive.enable': true,
      'queue.buffering.max.messages': 10,
      'queue.buffering.max.ms': 50,
      'batch.num.messages': 100,
      'api.version.request': true,
      'dr_cb': true
    }
  }
  var kafkaProducer = new Producer(kafkaConfig)
  await kafkaProducer.connect().then(async (result) => {
    const messageProtocol = {
      id: message.transferId,
      to: message.payeeFsp,
      from: message.payerFsp,
      type: 'application/json',
      content: {
        headers: headers,
        payload: message
      },
      metadata: {
        event: {
          id: Uuid(),
          type: 'prepare',
          action: 'prepare',
          createdAt: new Date(),
          status: 'success'
        }
      }
    }
    const topicConfig = {
      topicName: `topic-${message.payerFsp}-transfer-prepare`
    }
    return kafkaProducer.sendMessage(messageProtocol, topicConfig).catch(err => {
      const url = Config.DFSP_URLS[message.payerFsp]
      Notification.sendNotification(url, headers, message)
      Logger.error(`Kafka error:: ERROR:'${err}'`)
      throw err
    })
  }).catch(err => {
    Logger.error(`error connecting to kafka - ${err}`)
    throw err
  })
}

module.exports = {
  publishPrepare
}
