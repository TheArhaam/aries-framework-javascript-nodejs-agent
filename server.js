const express = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());

// ROUTES
const credentialRouter = require("./routes/api/credential");
app.use('/credential', credentialRouter);

app.listen(port, () => {
  console.log("Server is running on port:" + port);
});
