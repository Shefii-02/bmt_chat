// const express = require('express');
// const cors = require('cors');

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.get('/', (req, res) => {
//   res.json({ status: 'BookMyTeacher API running' });
// });

// module.exports = app;
const express = require("express");
const routes = require("./routes");

const app = express();
app.use(express.json());
app.use("/api", routes);

module.exports = app;
