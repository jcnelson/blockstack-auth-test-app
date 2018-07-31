const express = require('express')
const cors = require('cors')

const port = 1900   // blockstack 19.xx
const app = express()
app.use(cors())
app.use('/', express.static(__dirname + '/public'))
app.listen(port, (err) => {
  console.log(`server is listening on port ${port}`)
})
