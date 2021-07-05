const router = require("express").Router();
const fs = require('fs');
const { poll } = require('await-poll');
const fetch = require('node-fetch');
// WINDOWS: add LD_LIBRARY_PATH environment variable
const indy = require('indy-sdk');
const { Agent, decodeInvitationFromUrl, encodeInvitationToUrl, ProofRequest, ProofRequestTemplate } = require("aries-framework-javascript");
const axios = require('axios');
//const { fromCodePoint } = require("core-js/fn/string");

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
    mediatorUrl: "http://localhost:3001"
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

router.post("/issue-test", async (request, response) => {

  let data = { "0_age_uuid": [{ "cred_info": { "referent": "2df7ab2a-dd8d-4554-a8ac-14001470dc4f", "attrs": { "age": "99", "name": "test" }, "schema_id": "4cLztgZYocjqTdAZM93t27:2:test-schema:1.1", "cred_def_id": "4cLztgZYocjqTdAZM93t27:3:CL:43046:default", "rev_reg_id": null, "cred_rev_id": null }, "interval": null }], "0_name_uuid": [{ "cred_info": { "referent": "2df7ab2a-dd8d-4554-a8ac-14001470dc4f", "attrs": { "name": "test", "age": "99" }, "schema_id": "4cLztgZYocjqTdAZM93t27:2:test-schema:1.1", "cred_def_id": "4cLztgZYocjqTdAZM93t27:3:CL:43046:default", "rev_reg_id": null, "cred_rev_id": null }, "interval": null }] };


  console.log("---------------------------");


  let reqCred = {};
  let schemas = {};
  let credDef = {};
  Object.keys(data).forEach(function (key) {
    console.log('Key : ' + key);
    let dataKey = key;
    let item = data[key];
    if (item) {
      Object.keys(item).forEach(function (itemKey) {
        // console.log("sub:" + JSON.stringify(itemKey));
        if (item[itemKey].cred_info) {
          // Construct reqestedCredentials Object
          let credDefId = item[itemKey].cred_info.cred_def_id;
          if (credDefId) {
            //  console.log("value:" + JSON.stringify(credDefId));
            reqCred[dataKey] = { cred_id: credDefId };
            schemas[credDef] = '';//await agent2.ledger.getCredentialDefinition(credDef);
          }
          //Construct cred defination object

          //Construct schema object
          let schemaId = item[itemKey].cred_info.schema_id;
          if (schemaId) {
            //console.log("value:" + JSON.stringify(schemaId));
            schemas[schemaId] = '';//await agent2.ledger.getSchema(schemaId);
          }
        }
      });
    }
  })


  let req = {};
  req['reqCred'] = reqCred;
  req['schemas'] = schemas;
  req['credDef'] = credDef;

  console.log("OBJ-:" + JSON.stringify(req));
  // let schema1 = await agent2.ledger.getSchema(schemaId);
  // //console.log("Schema def id : "+schemaId);
  // //console.log("Cred def id : "+credDefId);
  // let sh = {
  //   // [schemaId]
  //   "4cLztgZYocjqTdAZM93t27:2:test-schema:1.1": schema1
  // }
  // let creDef1 = await agent2.ledger.getCredentialDefinition(credDefId);
  // //console.log("CedFDefff:" + JSON.stringify(creDef1))
  // let cd = {
  //   "4cLztgZYocjqTdAZM93t27:3:CL:43046:default": creDef1
  // }
  //var obj = JSON.parse( JSON.stringify(rc));




  // console.log("Cred:" + JSON.stringify(ee));
  // let rc = [];
  // Object.keys(data).forEach(function (key) {
  //   console.log('Key : ' + key);
  //   let dataKey = key;
  //   let item = data[key];
  //   if (item) {
  //     Object.keys(item).forEach(function (itemKey) {
  //       console.log("sub:" + JSON.stringify(itemKey));
  //       if (item[itemKey].cred_info && item[itemKey].cred_info.cred_def_id) {
  //         console.log("value:" + JSON.stringify(item[itemKey].cred_info.cred_def_id));
  //         rc.push({ [dataKey]: { cred_id: item[itemKey].cred_info.cred_def_id } });
  //       }
  //     });
  //   }
  // })


});

// ISSUE CREDENTIAL - ACA to ACA
router.post("/issue-aca", async (request, response) => {
  console.log("ISSUE CREDENTIAL - ACA to ACA");
  // INITIALIZE AGENT
  console.log("===========================================================================");
  console.log("INITIALIZE AGENTS")
  console.log("===========================================================================");
  const genesis = await downloadGenesis();
  // console.log("genesis: " + genesis);
  console.log("got genesis")

  const genesisPath = await storeGenesis(genesis, 'genesis.txn');
  console.log("genesisPath: " + genesisPath);

  const agent1Config = {
    label: 'javascript',
    walletConfig: { id: 'wallet' + Math.random() },
    walletCredentials: { key: '123' + Math.random() },
    autoAcceptConnections: true,
    poolName: 'test-103' + Math.random(),
    genesisPath,
    mediatorUrl: "http://localhost:3001",
    publicDidSeed: '00000000000000000000000000000001'
  };
  const agent2Config = {
    label: 'javascript',
    walletConfig: { id: 'wallet' + Math.random() },
    walletCredentials: { key: '123' + Math.random() },
    autoAcceptConnections: true,
    poolName: 'test-103' + Math.random(),
    genesisPath,
    mediatorUrl: "http://localhost:3001",
    publicDidSeed: '00000000000000000000000000000002'
  };
  console.log("agent1Config: ", agent1Config);
  console.log("agent2Config: ", agent2Config);

  const inbound1 = new InboundTransporter();
  const outbound1 = new OutboundTransporter();
  const inbound2 = new InboundTransporter();
  const outbound2 = new OutboundTransporter();

  const agent1 = new Agent(agent1Config, inbound1, outbound1, indy);
  const agent2 = new Agent(agent2Config, inbound2, outbound2, indy);
  await agent1.init();
  await agent2.init();
  console.log("AGENTS INITIALIZED");

  const publicDid1 = await agent1.getPublicDid();
  const publicDid2 = await agent2.getPublicDid();
  console.log("publicDid1: " + publicDid1.did);
  console.log("publicDid2: " + publicDid2.did);

  // CONNECT AGENTS
  console.log("===========================================================================");
  console.log("CONNECT AGENTS")
  console.log("===========================================================================");
  const newConnection = await agent1.connections.createConnection({ autoAcceptConnection: true });
  const invitationUrl = await encodeInvitationToUrl(newConnection.invitation, agent1.getMediatorUrl());

  const invitation = await decodeInvitationFromUrl(invitationUrl);
  const acceptedConnection = await agent2.connections.receiveInvitation(invitation.toJSON(), { autoAcceptConnection: true });

  const conn1 = await agent1.connections.find(newConnection.id);
  const conn2 = await agent2.connections.find(acceptedConnection.id);
  console.log("conn1 state: ", conn1.state);
  console.log("conn2 state: ", conn2.state);

  // CREATE SCHEMA
  console.log("===========================================================================");
  console.log("CREATE SCHEMA")
  console.log("===========================================================================");
  const schemaTemplate = {
    name: `test-schema`,
    attributes: ['name', 'age'],
    version: '1.1',
  };

  const [schemaId, ledgerSchema] = await registerSchema(agent1, schemaTemplate);

  await agent1.ledger.registerCredentialDefinition
  console.log("ledgerSchema: ", ledgerSchema);

  // CREATE CREDENTIAL DEFINITION
  console.log("===========================================================================");
  console.log("CREATE CREDENTIAL DEFINITION")
  console.log("===========================================================================");
  const definitionTemplate = {
    schema: ledgerSchema,
    tag: 'default',
    signatureType: 'CL',
    config: { support_revocation: false },
  };
  const [ledgerCredDefId] = await registerDefinition(agent1, definitionTemplate);
  credDefId = ledgerCredDefId;
  console.log("credDefId: ", credDefId);



  // ISSUE CREDENTIAL
  console.log("===========================================================================");
  console.log("ISSUE CREDENTIAL")
  console.log("===========================================================================");
  const newconn1 = await agent1.connections.find(newConnection.id);
  const newconn2 = await agent2.connections.find(acceptedConnection.id);
  console.log("conn1 state: ", newconn1.state);
  console.log("conn2 state: ", newconn2.state);
  const connection = await agent1.connections.find(newconn1.id);
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
  await agent1.credentials.issueCredential(connection, {
    credentialDefinitionId: credDefId,
    comment: 'Test Credential',
    preview: credentialPreview,
  })

  await sleep(5000);

  // ACCEPT CREDENTIAL OFFER
  console.log("===========================================================================");
  console.log("ACCEPT CREDENTIAL OFFER")
  console.log("===========================================================================");
  const [cred] = await agent2.credentials.getCredentials();
  console.log("cred: ", cred);
  try {
    await agent2.credentials.acceptCredential(cred);
  }
  catch (err) {
    console.log("ACCEPT ERR: ", err);
    return response.status(400).json("Credential Accept Error: " + err);
  }

  await sleep(5000);

  // CHECK CREDENTIAL STATE
  // console.log("===========================================================================");
  // console.log("CHECK CREDENTIAL STATE")
  // console.log("===========================================================================");
  // const [credNew] = await agent2.credentials.getCredentials();
  // console.log("credNew: ", credNew);
  // console.log("=================================")
  // console.log("");
  console.log("=========================");
  console.log("Send Proof request");
  console.log("============================")

  req_a = {
    "0_name_uuid": {
      "name": "name",
      "restrictions": [
        {
          "cred_def_id": credDefId
        }
      ]
    },
    "0_age_uuid": {
      "name": "age",
      "restrictions": [
        {
          "cred_def_id": credDefId
        }
      ]
    }
  }

  //Proof request Temple
  proofRequestTemplate = ({
    name: "Proof of Education",
    version: "1.0",
    //"nonce": str(uuid4().int),
    requestedAttributes: req_a,
    requestedPredicates: {}
  });

  agent1.proof.sendProofRequest(connection, {
    credentialDefinitionId: credDefId,
    comment: 'Test Proof',
    proofRequest: proofRequestTemplate
  });

  await sleep(6000);

  console.log("============================");
  console.log("GET ALL PROOF REQUEST");
  console.log("============================")

  console.log("---------Agent 1---------------------");
  const [proofReqSender] = await agent1.proof.getProofs();
  console.log(proofReqSender)
  console.log("------------Agent 2------------------");
  const [proofReqReceiver] = await agent2.proof.getProofs();
  console.log(proofReqReceiver)

  console.log("============================");
  console.log("GET CREDENTIALS FROM PROOF REQUEST");
  console.log("============================")

  //Proof request Temple
  proofRequestTemplate2 = ({
    name: "Proof of Education",
    version: "1.0",
    nonce: "39232323233",
    requested_attributes: req_a,
    requested_predicates: {}
  });

  console.log("============================");
  console.log("GENERATE PROOF");
  console.log("============================")

  console.log("calling to genrate proof:");
  await sleep(6000);

  await agent2.proof.sendPresentation(connection, proofRequestTemplate2);
  
  return response.status(200).json("Passed !");
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

async function registerSchema(agent, schemaTemplate) {
  const [schemaId] = await agent.ledger.registerCredentialSchema(schemaTemplate);

  console.log('schemaId', schemaId);
  const ledgerSchema = await agent.ledger.getSchema(schemaId);
  console.log('ledgerSchemaId, ledgerSchema', schemaId, ledgerSchema);
  return [schemaId, ledgerSchema];
}



async function registerDefinition(agent, definitionTemplate) {
  const [credDefId] = await agent.ledger.registerCredentialDefinition(definitionTemplate);
  const ledgerCredDef = await agent.ledger.getCredentialDefinition(credDefId);
  console.log('ledgerCredDefId, ledgerCredDef', credDefId, ledgerCredDef);
  return [credDefId, ledgerCredDef];
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
