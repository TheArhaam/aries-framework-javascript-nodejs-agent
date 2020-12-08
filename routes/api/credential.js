const router = require("express").Router();
const fs = require('fs');
const { poll } = require('await-poll');
const fetch = require('node-fetch');
// WINDOWS: add LD_LIBRARY_PATH environment variable
const indy = require('indy-sdk');
const { Agent, decodeInvitationFromUrl } = require("aries-framework-javascript");
const axios = require('axios');

// ISSUE CREDENTIAL
router.post("/issue", async (request, response) => {
  console.log("ISSUE CREDENTIAL");
  const { invitationUrl } = request.body;
  // INITIALIZE AGENT
  console.log("===========================================================================");
  console.log("INITIALIZE AGENT")
  console.log("===========================================================================");
  const genesis = await downloadGenesis();
  // console.log("genesis: " + genesis);
  console.log("got genesis")

  const genesisPath = await storeGenesis(genesis, 'genesis.txn');
  console.log("genesisPath: " + genesisPath);

  const agentConfig = {
    label: 'javascript',
    walletConfig: { id: 'wallet' + Math.random() },
    walletCredentials: { key: '123' + Math.random() },
    autoAcceptConnections: true,
    poolName: 'test-103' + Math.random(),
    genesisPath,
    mediatorUrl: process.env.MEDIATOR_URL
  };
  console.log("agentConfig: ", agentConfig);

  const inbound = new InboundTransporter();
  const outbound = new OutboundTransporter();

  const agent = new Agent(agentConfig, inbound, outbound, indy);
  await agent.init();
  console.log("AGENT INITIALIZED");
  await agent.wallet.initPublicDid();
  // await agent.ledger.registerPublicDid();
  const publicDid = await agent.getPublicDid();
  console.log("publicDid: " + publicDid.did);

  // ACCEPT CONNECTION
  console.log("===========================================================================");
  console.log("ACCEPT CONNECTION")
  console.log("===========================================================================");
  const invitation = await decodeInvitationFromUrl(invitationUrl);
  const acceptedConnection = await agent.connections.receiveInvitation(invitation.toJSON(), { autoAcceptConnection: true });
  const connId = acceptedConnection.id;
  console.log("acceptedConnection: ", acceptedConnection)

  // CREATE SCHEMA
  console.log("===========================================================================");
  console.log("CREATE SCHEMA")
  console.log("===========================================================================");
  const schemaTemplate = {
    name: `test-schema-${Math.random()}`,
    attributes: ['name', 'age'],
    version: '1.0',
  };
  const [schemaId, ledgerSchema] = await agent.ledger.registerCredentialSchema(schemaTemplate);
  console.log("schemaId: ", schemaId);
  console.log("ledgerSchema: ", ledgerSchema);

  // CREATE CREDENTIAL DEFINITION
  console.log("===========================================================================");
  console.log("CREATE CREDENTIAL DEFINITION")
  console.log("===========================================================================");
  const definitionTemplate = {
    schema: ledgerSchema,
    tag: 'TAG',
    signatureType: 'CL',
    config: { support_revocation: false },
  };
  const [credDefId, ledgerCredDef] = await agent.ledger.registerCredentialDefinition(definitionTemplate);
  console.log("credDefId: ", credDefId);
  console.log("ledgerCredDefId: ", ledgerCredDef);

  // ISSUE CREDENTIAL
  console.log("===========================================================================");
  console.log("ISSUE CREDENTIAL")
  console.log("===========================================================================");
  const connection = await agent.connections.find(connId);
  console.log("connection: ", connection);
  const credentialPreview = ({
    attributes: [
      {
        name: 'name',
        mimeType: 'text/plain',
        value: 'test',
      },
      {
        name: 'age',
        mimeType: 'text/plain',
        value: '99',
      },
    ],
  });
  await agent.credentials.issueCredential(connection, {
    credentialDefinitionId: credDefId,
    comment: 'Test Credential',
    preview: credentialPreview,
  })

  return response.status(200).json("Credential Issued!");
});



class InboundTransporter {
  constructor() {
    this.stop = false;
  }
  async start(agent) {
    await this.registerMediator(agent);
  }

  async registerMediator(agent) {
    const mediatorUrl = agent.getMediatorUrl();
    const mediatorInvitationUrlResponse = await axios.get(
      `${mediatorUrl}/invitation`,
    );
    const response = await axios.get(`${mediatorUrl}/`);
    const { verkey: mediatorVerkey } = response.data;
    await agent.routing.provision({
      verkey: mediatorVerkey,
      invitationUrl: mediatorInvitationUrlResponse.data,
    });
    this.pollDownloadMessages(agent);
  }

  pollDownloadMessages(agent) {
    poll(
      async () => {
        const downloadedMessages = await agent.routing.downloadMessages();
        const messages = [...downloadedMessages];
        while (messages && messages.length > 0) {
          const message = messages.shift();
          await agent.receiveMessage(message);
        }
      },
      () => !this.stop,
      1000,
    );
  }
}

class OutboundTransporter {
  async sendMessage(outboundPackage, receiveReply) {
    const { payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(
        `Missing endpoint. I don't know how and where to send the message.`,
      );
    }

    try {
      if (receiveReply) {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const data = await response.text();

        const wireMessage = JSON.parse(data);
        return wireMessage;
      } else {
        await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      console.log('error sending message', JSON.stringify(e));
      throw e;
    }
  }
}

// STORE GENESIS TRANSACTION FILE
async function storeGenesis(genesis, fileName) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, genesis, { encoding: 'utf-8' }, (err) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(`./${fileName}`);
      }
    })
  })
}

// DOWNLOAD GENESIS TRANSACTION FILE
async function downloadGenesis() {
  const url = 'http://dev.greenlight.bcovrin.vonx.io/genesis';
  const response = await axios.get(url);
  return response.data;
}

module.exports = router;