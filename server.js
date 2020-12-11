const express = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());

// const indy = require('indy-sdk');
// indy.setLogger(function (level, target, message, modulePath, file, line) {
//   console.log('libindy said:', level, target, message, modulePath, file, line)
// })

// ROUTES
const credentialRouter = require("./routes/api/credential");
app.use('/credential', credentialRouter);

app.listen(port, () => {
  console.log("Server is running on port:" + port);
});
